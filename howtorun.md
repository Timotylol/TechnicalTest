# How to Run & Test — Play & Win

## 1. Install & Start
Open PowerShell in the project folder (`TechnicalTest`):

```powershell
npm.cmd install
npm.cmd start
```

*(Using `npm.cmd` avoids Windows PowerShell execution-policy blocks on `npm.ps1`.)*

`npm.cmd start` launches both:
- **Express backend** (`server.js`) on `http://localhost:3001`
- **Vite frontend** (`vite --host`) on `http://localhost:5173`

---

## 2. Open on Desktop or Phone
- **Desktop:** Open `http://localhost:5173` (press `F12` -> `Ctrl + Shift + M` for mobile view).
- **Phone (same Wi-Fi or hotspot):** Open the **Network** URL printed by Vite (e.g. `http://192.168.1.23:5173`).
  - If your phone cannot connect on Windows, allow Node.js through Windows Firewall or connect via your phone's hotspot.

---

## 3. Stop the Server
In the terminal running `npm.cmd start`:
1. Press **Ctrl + C**.
2. If Windows prompts `Terminate batch job (Y/N)?`, press **Y** and **Enter**.

*(If a Node process stays running in the background, force-stop it with `taskkill /F /IM node.exe`.)*

---

## 4. Tilt Controls vs. Drag / Tap (Important Note)
Modern mobile browsers (**iOS Safari** and **Android Chrome**) **require HTTPS** (`https://`) to access `DeviceOrientationEvent` tilt sensors.

- **Default HTTP (`http://<LAN-IP>:5173`):** Both the Quiz and MiniGame automatically fall back to **Drag / Tap** controls so everything works cleanly without browser certificate warnings.
- **Testing Tilt on Desktop (`localhost`):** In Chrome/Edge DevTools (`F12`), open **More tools → Sensors** and adjust **Orientation** to test tilt on `http://localhost:5173`.
- **Enabling Tilt on a Real Phone over Wi-Fi (HTTPS):**
  1. Install the Vite basic SSL plugin:
     ```powershell
     npm.cmd install -D @vitejs/plugin-basic-ssl
     ```
  2. Update `vite.config.js`:
     ```js
     import basicSsl from '@vitejs/plugin-basic-ssl'

     export default {
       plugins: [basicSsl()],
       server: { proxy: { '/api': 'http://localhost:3001' } },
     }
     ```
  3. Restart with `npm.cmd start` and open the **`https://<LAN-IP>:5173`** URL on your phone (accept the self-signed certificate warning once, then allow Motion & Orientation when prompted).
