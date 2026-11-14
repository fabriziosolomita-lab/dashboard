# Studio Solomita — App

Questa è l'app installabile (PWA) del *Sistema Operativo Integrato 2026* dello Studio Solomita. Contiene scadenzario, checklist giornaliere, cartelline Bilancio e Unico, procedure dell'area lavoro, template email/PEC e KPI.

## Cosa fa l'app
- **Si installa** su telefono, tablet e computer e si apre a schermo intero dall'icona.
- **Funziona offline**: dopo la prima apertura non serve più la connessione.
- **Salva da sola** le spunte, le scadenze aggiunte, i template email, le note e i campi delle cartelline (società, n. pratica, stato…), oltre al nome dell'operatore.
- **Backup**: dal menu *App* puoi esportare un file `.json` e ripristinarlo su un altro dispositivo.
- **Menu mobile**: su smartphone la barra laterale si apre con il pulsante ☰.

> I dati restano salvati **sul singolo dispositivo**, nel browser. Per passarli su un altro dispositivo usa *Esporta backup* e poi *Ripristina backup*.

## Come pubblicarla (GitHub Pages)
1. Su GitHub apri **Settings → Pages**.
2. In *Source* scegli **Deploy from a branch**, poi seleziona il branch e la cartella `/ (root)`.
3. Dopo circa un minuto l'app sarà online su `https://<utente>.github.io/dashboard/`.

Se il repository è privato, GitHub Pages richiede un piano a pagamento. In alternativa puoi usare un servizio di hosting statico come Netlify o Cloudflare Pages. Basta che il sito sia servito in **HTTPS**.

## Come installarla
- **Android / Chrome / Edge**: apri il sito e tocca **📲 Installa l'app** nel menu, oppure usa "Installa app" dal menu del browser.
- **iPhone / iPad (Safari)**: tocca Condividi (□↑) e poi **Aggiungi alla schermata Home**.
- **Windows / Mac (Chrome o Edge)**: clicca l'icona di installazione nella barra degli indirizzi.

## File
| File | A cosa serve |
|---|---|
| `index.html` | La dashboard (contenuti e procedure) |
| `app.js` | Salvataggio dati, backup, menu mobile, installazione |
| `sw.js` | Service worker per l'uso offline |
| `manifest.webmanifest` | Nome, colori e icone dell'app |
| `icons/` | Icone dell'app |

Quando modifichi i file, aumenta `VERSION` in `sw.js` (per esempio `v2`). Così chi ha già installato l'app riceve l'aggiornamento.
