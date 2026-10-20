// Genera QR e bozza della fiancata «Ti è piaciuta? Dillo a Google.» (HTML → PNG con Edge senza interfaccia).
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const QRCode = require("qrcode");

const OUT = path.resolve(__dirname, "../QR da stampare");
const URL_REC = "https://ordina.donbasilico.it/recensione";
const baffo = "data:image/png;base64," + fs.readFileSync(path.resolve(__dirname, "public/ordina-icons/baffi.png")).toString("base64");

(async () => {
  const opz = { margin: 4, errorCorrectionLevel: "H", color: { dark: "#1B1E17", light: "#FFFFFF" } };
  await QRCode.toFile(path.join(OUT, "QR-recensione-google.png"), URL_REC, { ...opz, width: 1600 });
  await QRCode.toFile(path.join(OUT, "QR-recensione-google.svg"), URL_REC, { ...opz, type: "svg" });

  const qr = await QRCode.toString(URL_REC, { type: "svg", margin: 0, errorCorrectionLevel: "H", color: { dark: "#1B1E17", light: "#FFFFFF" } });
  const stella = `<svg viewBox="0 0 24 24" width="62" height="62" fill="#7ED321" stroke="#7ED321" stroke-width="1.2" stroke-linejoin="round"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z"/></svg>`;
  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@800&family=Jost:wght@500;700&display=swap">
<style>
  *{box-sizing:border-box;margin:0}
  html,body{width:3240px;height:600px;overflow:hidden}
  .fiancata{position:relative;width:3240px;height:600px;background:linear-gradient(100deg,#9ad933 0%,#6fb21e 55%,#5a9a17 100%);overflow:hidden;font-family:'Jost',Arial,sans-serif}
  .baffi{position:absolute;inset:-100px;background-image:url(${baffo});background-size:230px auto;opacity:.22;filter:brightness(.55);transform:rotate(-6deg)}
  .carta{position:absolute;left:1120px;top:70px;width:2030px;height:460px;border-radius:72px;background:#fff;display:flex;align-items:center;gap:70px;padding:0 80px 0 70px;box-shadow:0 14px 40px rgba(0,40,0,.25)}
  .qr{flex:0 0 340px;width:340px;height:340px}
  .qr svg{width:100%;height:100%;display:block}
  .testo{flex:1}
  .stelle{display:flex;gap:8px;margin-bottom:6px}
  h1{font-family:'Playfair Display',Georgia,serif;font-weight:800;font-size:128px;line-height:1.04;color:#1B1E17;letter-spacing:-1px}
  .sotto{margin-top:20px;font-size:52px;font-weight:500;color:#3E4237;line-height:1.25}
  .sotto b{font-weight:700;color:#1B1E17}
</style></head><body>
<div class="fiancata"><div class="baffi"></div>
  <div class="carta">
    <div class="qr">${qr}</div>
    <div class="testo">
      <div class="stelle">${stella}${stella}${stella}${stella}${stella}</div>
      <h1>Ti è piaciuta?<br>Dillo a Google.</h1>
      <div class="sotto">Inquadra il codice · <b>scegli la tua pizzeria</b> · ci aiuti un sacco</div>
    </div>
  </div>
</div></body></html>`;
  const file = path.join(OUT, "fiancata-recensione-google.html");
  fs.writeFileSync(file, html, "utf8");
  const png = path.join(OUT, "fiancata-recensione-google.png");
  execFileSync("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    "--window-size=3240,600", "--virtual-time-budget=8000", `--screenshot=${png}`, "file:///" + file.replace(/\\/g, "/"),
  ], { stdio: "ignore", timeout: 60000 });
  console.log("creati QR e fiancata:", fs.statSync(png).size, "byte");
})();
