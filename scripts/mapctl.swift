/* Synthesised mouse input, because Apple Maps has no other way in.
 *
 * WHY THIS EXISTS
 * Apple's Snapshot API is orthographic by contract — center/z/size/scale/t/poi
 * and nothing else, so it can never answer a facade question. Apple's oblique
 * 3D exists only inside Maps.app, which exposes no scripting for the camera and
 * whose map view is a single opaque AXGroup: no buttons, no sliders, nothing
 * the Accessibility API can drive. Keyboard is a dead end too — the only camera
 * shortcuts in the View menu are zoom, default zoom, and snap-to-north, and
 * option+arrow is zoom rather than tilt.
 *
 * What is left is the pointer. Maps tilts on an option-drag and rotates on a
 * command-drag, so a CGEvent stream is the whole control surface for pitch and
 * heading. Drags are stepped rather than teleported because the map tracks
 * intermediate motion; a single jump event moves the camera a fraction of the
 * distance or not at all.
 *
 *   swiftc -O scripts/mapctl.swift -o .cache/mapctl
 *   .cache/mapctl click 1482 320
 *   .cache/mapctl drag 700 500 700 300 option 40
 *   .cache/mapctl scroll 700 500 -6
 */
import CoreGraphics
import Foundation

let args = Array(CommandLine.arguments.dropFirst())

func modifiers(_ s: String?) -> CGEventFlags {
  var f: CGEventFlags = []
  for name in (s ?? "").split(separator: "+") {
    switch name {
    case "option", "alt": f.insert(.maskAlternate)
    case "command", "cmd": f.insert(.maskCommand)
    case "shift": f.insert(.maskShift)
    case "control", "ctrl": f.insert(.maskControl)
    case "none", "": break
    default: FileHandle.standardError.write("unknown modifier \(name)\n".data(using: .utf8)!); exit(2)
    }
  }
  return f
}

func post(_ type: CGEventType, _ p: CGPoint, _ flags: CGEventFlags, button: CGMouseButton = .left) {
  guard let e = CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: p, mouseButton: button)
  else { return }
  e.flags = flags
  e.post(tap: .cghidEventTap)
}

/* Maps needs a beat between the press, the motion and the release, or it reads
   the whole gesture as a click and the camera never moves. */
func settle(_ ms: UInt32 = 60_000) { usleep(ms) }

switch args.first {
/* The window moves — a new window opens at the system's default placement, a
   navigation can resize it, and a stale rectangle means gestures land on the
   desktop and screenshots capture whatever is behind. Ask the window server
   where it is, every time, and capture it by id rather than by rectangle. */
case "window":
  let owner = args.count > 1 ? args[1] : "Maps"
  guard let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID)
          as? [[String: Any]] else { exit(3) }
  let candidates = list.filter { ($0[kCGWindowOwnerName as String] as? String) == owner }
    .compactMap { w -> (Int, CGRect)? in
      guard let id = w[kCGWindowNumber as String] as? Int,
            let b = w[kCGWindowBounds as String] as? [String: CGFloat],
            let x = b["X"], let y = b["Y"], let width = b["Width"], let height = b["Height"]
      else { return nil }
      return (id, CGRect(x: x, y: y, width: width, height: height))
    }
    /* Maps keeps a slim accessory window alongside the map; take the biggest. */
    .sorted { $0.1.width * $0.1.height > $1.1.width * $1.1.height }
  guard let win = candidates.first else { exit(4) }
  print("\(win.0) \(Int(win.1.origin.x)) \(Int(win.1.origin.y)) \(Int(win.1.width)) \(Int(win.1.height))")

case "move":
  post(.mouseMoved, CGPoint(x: Double(args[1])!, y: Double(args[2])!), [])

case "click":
  let p = CGPoint(x: Double(args[1])!, y: Double(args[2])!)
  let f = modifiers(args.count > 3 ? args[3] : nil)
  post(.mouseMoved, p, f); settle()
  post(.leftMouseDown, p, f); settle(40_000)
  post(.leftMouseUp, p, f)

case "drag":
  let a = CGPoint(x: Double(args[1])!, y: Double(args[2])!)
  let b = CGPoint(x: Double(args[3])!, y: Double(args[4])!)
  let f = modifiers(args.count > 5 ? args[5] : nil)
  let steps = args.count > 6 ? Int(args[6])! : 30
  post(.mouseMoved, a, f); settle()
  post(.leftMouseDown, a, f); settle(120_000)
  for i in 1...steps {
    let t = Double(i) / Double(steps)
    post(.leftMouseDragged, CGPoint(x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t), f)
    usleep(12_000)
  }
  settle(120_000)
  post(.leftMouseUp, b, f)

case "scroll":
  let p = CGPoint(x: Double(args[1])!, y: Double(args[2])!)
  let dy = Int32(args[3])!
  let f = modifiers(args.count > 4 ? args[4] : nil)
  post(.mouseMoved, p, f); settle()
  /* One event per notch: Maps accelerates on a single large delta, which makes
     the zoom level unrepeatable between runs. */
  for _ in 0..<abs(dy) {
    guard let e = CGEvent(scrollWheelEvent2Source: nil, units: .line, wheelCount: 1,
                          wheel1: dy > 0 ? 1 : -1, wheel2: 0, wheel3: 0) else { break }
    e.location = p
    e.flags = f
    e.post(tap: .cghidEventTap)
    usleep(45_000)
  }

default:
  print("""
  usage:
    mapctl move <x> <y>
    mapctl click <x> <y> [mods]
    mapctl drag <x1> <y1> <x2> <y2> [mods] [steps]
    mapctl scroll <x> <y> <notches> [mods]
      mods: option|command|shift|control, joined with +
  """)
  exit(1)
}
