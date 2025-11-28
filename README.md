# SD Mini Character Lab

A small browser demo that takes a 2D face image, crops and tones it, and projects it onto a super-deformed (chibi) 3D body. Everything runs locally in the browser—no builds or servers required.
<img width="2476" height="1838" alt="image" src="https://github.com/user-attachments/assets/5cffab20-81fb-4d7a-84b8-0b6d1738b5fa" />

<img width="2610" height="1846" alt="image" src="https://github.com/user-attachments/assets/2549d752-b1e8-4569-ba2e-6d3efbcae87a" />


## 클론 후 실행 (한국어)

1. 리포지토리 클론  
   ```bash
   git clone https://github.com/GistKjoon/SD-sim.git
   cd SD-sim
   ```
2. Node.js 18+가 필요합니다. 설치 후 의존성 설치:  
   ```bash
   npm install
   ```
3. 실행 (Electron 데스크톱 앱):  
   ```bash
   npm start
   ```
4. 앱 창에서 얼굴 이미지를 드롭/선택 → “원본에서 선택” 캔버스를 클릭해 얼굴 중심 지정 → 슬라이더로 확대/위치/톤 보정 → 3D 프리뷰 확인 → “텍스처 저장”으로 PNG 저장.

## Clone & Run (English)

1. Clone the repo  
   ```bash
   git clone https://github.com/GistKjoon/SD-sim.git
   cd SD-sim
   ```
2. Install Node.js 18+ if you don’t have it, then install deps:  
   ```bash
   npm install
   ```
3. Run (Electron desktop app):  
   ```bash
   npm start
   ```
4. In the app: drop/pick a face image → click the source canvas to set face center → adjust scale/offset/tone → preview in 3D → save the processed PNG via “텍스처 저장”.

## Notes

- The processor renders to a 512×512 canvas and feeds that as a live Three.js `CanvasTexture` onto the head sphere. The head is ~60% of the total height for an SD look, with a simple bob/wave idle animation.
- All assets are local; Three.js and OrbitControls are vendored in `libs/` so 오프라인에서도 동작합니다.
- The sample face art lives at `assets/sample-face.svg`. Replace it with your own default if you want a different starter.

## Electron 앱으로 실행 (브라우저 없이)

1. Node.js 18+가 설치돼 있어야 합니다.
2. 의존성 설치: `npm install`
3. 실행: `npm start` — Electron 창에서 바로 데모가 열립니다.

## Files

- `index.html` — Layout and UI wiring
- `style.css` — Look-and-feel
- `main.js` — Face processing, texture updates, and Three.js scene
- `assets/sample-face.svg` — Default face art used by the **Use sample face** button
