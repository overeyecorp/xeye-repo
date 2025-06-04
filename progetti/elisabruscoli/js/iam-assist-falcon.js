// iam-assist-falcon.js

// Stato per il contact flow (globale)
let contactStep = 0;
let faqs = [];
let contactFaqs = [];

// Carica le FAQ generali
async function loadFAQs() {
  try {
    const response = await fetch('/js/faq.json');
    const data = await response.json();
    return data.faqs;
  } catch (error) {
    console.error("Errore nel caricamento delle FAQ:", error);
    return [];
  }
}

// Carica le FAQ di contatto
async function loadContactFAQs() {
  try {
    const response = await fetch('/js/faq_contact.json');
    const data = await response.json();
    return data.contact;
  } catch (error) {
    console.error("Errore nel caricamento delle FAQ di contatto:", error);
    return [];
  }
}

// Gestione dell'input utente
async function handleUserInput(userInput) {
  const text = userInput.trim().toLowerCase();
  const tokens = text.split(/\W+/).filter(t => t);

  // 1) Trigger “contact me”
  if (contactStep === 0 && contactFaqs.length) {
    const trigger = contactFaqs[0];
    const keys = trigger.question.toLowerCase().split(/\W+|\|/).map(k => k.trim());
    if (tokens.some(tok => keys.includes(tok))) {
      contactStep = 1;
      return trigger.answer;
    }
  }

  // 2) Raccolta email
  if (contactStep === 1) {
    collectedEmail = userInput.trim();    // salvo l’email
    contactStep = 2;
    return contactFaqs[1].answer;
  }


// 3) Raccolta motivo → invio a Netlify Forms (plain-text)
if (contactStep === 2) {
  const reason = userInput.trim();

  const formData = new URLSearchParams();
  formData.append('form-name', 'contact');
  formData.append('email', collectedEmail);
  formData.append('_replyto', collectedEmail);
  formData.append('subject', `Nuova richiesta contatto Overeye da: ${collectedEmail}`);
  formData.append(
    'message',
    `Ciao,\n\nHai un nuovo messaggio da: ${collectedEmail}\n\nMotivo del contatto:\n${reason}`
  );

  await fetch('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString()
  });

  contactStep = 0;
  return contactFaqs[2].answer;
}








  // 4) Fallback FAQ generali
  for (const faq of faqs) {
    const keys = faq.question.toLowerCase().split(/\W+|\|/).map(k => k.trim());
    if (tokens.some(tok => keys.includes(tok))) {
      return faq.answer;
    }
  }

  return "Sorry, I don't have an answer to that question.";
}


// Creazione e avvio UI chat
function createChatUI() {
  // Aggiunta stili dinamici
  const style = document.createElement('style');
  style.innerHTML = `
      #iam-chatbot-button {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 20px;
        height: 20px;
        background: transparent;
        border: none;
        cursor: pointer;
        z-index: 1500;
        padding: 0;
        opacity: 0;
        animation: fadeIn 1s ease forwards 1.5s;
      }

      #iam-chatbot-button img {
        width: 100%;
        height: 100%;
        filter: none; 
        transition: filter 0.3s ease, transform 0.3s ease;
      }

      #iam-chatbot-button:hover img {
        filter: brightness(0) saturate(100%) invert(36%) sepia(92%) saturate(1061%) hue-rotate(180deg) brightness(96%) contrast(98%);
        transform: scale(1.1);
      }

      #iam-chatbot-box {
        position: fixed;
        bottom: 70px;
        right: 20px;
        width: 360px;
        height: 440px;
        background: #1a1a1a;
        color: #fff;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        display: none;
        flex-direction: column;
        overflow: hidden;
        z-index: 1499;
        font-family: 'Inter', sans-serif;
      }

      #iam-chat-header {
        background: #222;
        padding: 12px;
        font-weight: bold;
        text-align: center;
        border-bottom: 1px solid #333;
      }

      #iam-chat-messages {
        flex: 1;
        padding: 12px;
        overflow-y: auto;
        font-size: 0.95rem;
      }

      #iam-chat-input {
        display: flex;
        border-top: 1px solid #333;
      }

      #iam-chat-input input {
        flex: 1;
        padding: 10px;
        border: none;
        background: #000;
        color: #fff;
      }

      #iam-chat-input button {
        background: #00c6ff;
        color: #000;
        border: none;
        padding: 0 20px;
        cursor: pointer;
        font-weight: bold;
      }

      @keyframes fadeIn {
        to { opacity: 1; }
      }
    `;
  document.head.appendChild(style);

  // Creazione bottone
  const btn = document.createElement('button');
  btn.id = 'iam-chatbot-button';
  btn.innerHTML = '<img src="js/chatai.png" alt="AI Chat Icon" />';
  btn.addEventListener('click', () => {
    const box = document.getElementById('iam-chatbot-box');
    box.style.display = box.style.display === 'flex' ? 'none' : 'flex';
  });
  document.body.appendChild(btn);

  // Creazione box chat
  const box = document.createElement('div');
  box.id = 'iam-chatbot-box';
  box.innerHTML = `
    <div id="iam-chat-header">FUSION AI</div>
    <div id="iam-chat-messages"></div>
    <div id="iam-chat-input">
      <input type="text" placeholder="Ask Me..." />
      <button>Send</button>
    </div>
  `;
  document.body.appendChild(box);

  const input = box.querySelector('input');
  const send = box.querySelector('button');
  const messages = box.querySelector('#iam-chat-messages');

  // Funzione invio
  async function sendMessage() {
    const userText = input.value.trim();
    if (!userText) return;
    input.disabled = send.disabled = true;

    appendMessage('You', userText);
    input.value = '';

    // Indicatore di thinking
    const thinking = document.createElement('div');
    thinking.style.opacity = '0.6';
    thinking.style.fontStyle = 'italic';
    thinking.textContent = 'Fusion AI: Thinking...';
    messages.appendChild(thinking);
    messages.scrollTop = messages.scrollHeight;

    try {
      const resp = await handleUserInput(userText);
      thinking.remove();
      await typeAIResponse('Fusion AI', resp);
    } catch (err) {
      thinking.remove();
      console.error(err);
      appendMessage('Fusion AI', 'Errore, riprova.');
    }

    input.disabled = send.disabled = false;
    input.focus();
  }

  // Effetto digitazione
  async function typeAIResponse(sender, text) {
    const msg = document.createElement('div');
    msg.innerHTML = `<strong>${sender}:</strong> `;
    const span = document.createElement('span');
    msg.appendChild(span);
    messages.appendChild(msg);

    for (const word of text.split(' ')) {
      span.textContent += word + ' ';
      messages.scrollTop = messages.scrollHeight;
      await new Promise(r => setTimeout(r, 60));
    }
  }

  // Aggiunge messaggio
  function appendMessage(sender, text) {
    const msg = document.createElement('div');
    msg.innerHTML = `<strong>${sender}:</strong> ${text}`;
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
  }

  send.addEventListener('click', sendMessage);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });
}

// Inizializzazione dopo load
window.addEventListener('load', async () => {
  faqs = await loadFAQs();
  contactFaqs = await loadContactFAQs();
  createChatUI();
});
