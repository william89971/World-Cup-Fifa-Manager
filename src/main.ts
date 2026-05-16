import './styles.css';
import { Game } from './game/Game';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Missing #app root element.');
}

const loadingScreen = app.querySelector<HTMLElement>('.loading-screen');
const offlineBanner = document.createElement('div');
offlineBanner.className = 'offline-banner';
offlineBanner.textContent = 'Offline mode: saved app shell is available; live updates may be unavailable.';
document.body.append(offlineBanner);

function updateOfflineBanner(): void {
  offlineBanner.classList.toggle('offline-banner--visible', !navigator.onLine);
}

window.addEventListener('online', updateOfflineBanner);
window.addEventListener('offline', updateOfflineBanner);
updateOfflineBanner();

void Game.create(app)
  .then((game) => {
    loadingScreen?.remove();
    game.start();
  })
  .catch((error) => {
    console.error(error);
    if (loadingScreen) {
      loadingScreen.innerHTML = `
        <strong>World 5s Cup could not start.</strong>
        <span>Refresh the page or try again once your browser is online.</span>
      `;
    }
  });
