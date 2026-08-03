// The minimap: where you are, on the campus you are in.
//
// The background IS the aerial photograph — campus-colors.json's terrain grid
// was sampled from NAIP imagery, so painting its palette-indexed cells gives a
// true satellite underlay for free, roofs and canyons included. The guided
// walk draws over it in gold; you are the white dot with the view wedge.
//
// Drawn in 2D canvas, not WebGL: it is a HUD instrument, and a second GL
// context would cost more than the whole minimap is worth.

export function createMinimap(canvas, { colors, lidar, route }) {
  if (!canvas || !colors?.terrain) return { update() {} };
  const t = lidar.terrain;
  const worldW = (t.cols - 1) * t.cell;
  const worldH = (t.rows - 1) * t.cell;
  const W = canvas.width;
  const H = canvas.height;
  const sx = W / worldW;
  const sz = H / worldH;
  const px = (x) => (x - t.x0) * sx;
  const pz = (z) => (z - t.z0) * sz;

  /* Paint the aerial once into an offscreen canvas. */
  const bg = document.createElement("canvas");
  bg.width = W;
  bg.height = H;
  {
    const ctx = bg.getContext("2d");
    const ct = colors.terrain;
    const idx = Uint8Array.from(atob(ct.idx), (ch) => ch.charCodeAt(0));
    const cellW = Math.ceil((ct.cell / worldW) * W) + 1;
    const cellH = Math.ceil((ct.cell / worldH) * H) + 1;
    ctx.fillStyle = "#20262b";
    ctx.fillRect(0, 0, W, H);
    for (let r = 0; r < ct.rows; r++) {
      for (let c = 0; c < ct.cols; c++) {
        const k = idx[r * ct.cols + c];
        if (k === 255) continue;
        ctx.fillStyle = ct.palette[k] || "#556";
        ctx.fillRect(px(ct.x0 + c * ct.cell), pz(ct.z0 + r * ct.cell), cellW, cellH);
      }
    }
    /* The guided walk, so the dot has a story to sit on. */
    if (route?.points?.length) {
      ctx.strokeStyle = "#ffcd00";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px(route.points[0].x), pz(route.points[0].z));
      for (const p of route.points) ctx.lineTo(px(p.x), pz(p.z));
      ctx.stroke();
    }
  }

  const ctx = canvas.getContext("2d");
  let frame = 0;
  return {
    /** Redraw the marker over the cached aerial. Cheap; throttled anyway. */
    update(x, z, yaw) {
      if (frame++ % 3) return;
      ctx.drawImage(bg, 0, 0);
      const cx = px(x);
      const cz = pz(z);
      /* View wedge first, dot on top. World yaw 0 faces +z (south). */
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.beginPath();
      ctx.moveTo(cx, cz);
      for (const off of [-0.45, 0.45]) {
        ctx.lineTo(cx + Math.sin(yaw + off) * 16, cz + Math.cos(yaw + off) * 16);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#06384d";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cz, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    },
  };
}
