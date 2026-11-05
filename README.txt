Sporty - AI Movement Coach

Run:   npm start        (or: node server.js 8000)
Open:  http://localhost:8000/   (camera needs localhost or https)

Alt:   python3 -m http.server 8000

- Demo login: demo@sporty.app / sporty123
- Pose model + MediaPipe engine are bundled in vendor/ (.wasm-suffixed data files are intentional).
- Progress/streaks persist in this browser via js/storage-shim.js (localStorage).
- Team panel runs in solo mode outside the Claude artifact runtime.
- Online coach: pick "Online (OpenRouter)" and paste a key (kept in memory only).
