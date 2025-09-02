const userList = document.getElementById('userSelect');
const chat = document.getElementById('chat');
const dmForm = document.getElementById('dmForm');
const userStatus = document.getElementById('userStatus');

let currentReceiverId = null;
let currentUser = { id: null, username: "NIEZALOGOWANY" };

// Pobranie zalogowanego użytkownika
async function loadCurrentUser() {
    try {
        const res = await fetch('/session');
        const data = await res.json();
        currentUser = data;
        userStatus.textContent = 'Jesteś zalogowany jako: ' + (currentUser.username || "NIEZALOGOWANY");
    } catch (err) {
        console.error('Błąd pobierania sesji:', err);
        userStatus.textContent = 'Jesteś zalogowany jako: NIEZALOGOWANY';
    }
}

// Wczytaj użytkowników
async function loadUsers() {
    try {
        const res = await fetch('/users');
        const users = await res.json();
        userList.innerHTML = '';
        users.forEach(u => {
            const li = document.createElement('li');
            li.textContent = u.username;
            li.dataset.id = u.id;
            li.classList.add('user-item');
            li.addEventListener('click', () => selectUser(u.id));
            userList.appendChild(li);
        });
        if(users.length > 0 && !currentReceiverId) selectUser(users[0].id);
    } catch (err) {
        console.error('Błąd przy ładowaniu użytkowników:', err);
    }
}

// Wybór użytkownika
function selectUser(id) {
    currentReceiverId = id;
    document.querySelectorAll('.user-item').forEach(li => li.classList.remove('active'));
    const selected = Array.from(userList.children).find(li => li.dataset.id == id);
    if(selected) selected.classList.add('active');
    loadMessages();
}

// Wczytaj wiadomości
async function loadMessages() {
    if(!currentReceiverId) return;
    try {
        const res = await fetch(`/messages/${currentReceiverId}`);
        const msgs = await res.json();
        const nearBottom = chat.scrollHeight - chat.scrollTop <= chat.clientHeight + 50;

        chat.innerHTML = '';
        msgs.forEach(m => {
            const div = document.createElement('div');
            div.classList.add('message');

            // outgoing/incoming
            if(m.sender_id === currentUser.id) div.classList.add('message-outgoing');
            else div.classList.add('message-incoming');

            // treść
            const textDiv = document.createElement('div');
            textDiv.textContent = m.content;
            div.appendChild(textDiv);

            // obrazek
            if(m.image){
                const img = document.createElement('img');
                img.src = m.image;
                div.appendChild(img);
            }

            // przycisk usuń (tylko własne wiadomości)
            if(m.sender_id === currentUser.id){
                const delBtn = document.createElement('button');
                delBtn.textContent = 'Usuń';
                delBtn.classList.add('delete-btn');
                delBtn.addEventListener('click', async () => {
                    if(confirm('Na pewno chcesz usunąć wiadomość?')){
                        const res = await fetch(`/message/${m.id}`, { method: 'DELETE' });
                        if(res.ok) loadMessages();
                        else alert('Nie udało się usunąć wiadomości');
                    }
                });
                div.appendChild(delBtn);
            }

            chat.appendChild(div);
        });

        if(nearBottom) chat.scrollTop = chat.scrollHeight;
    } catch(err) {
        console.error('Błąd przy ładowaniu wiadomości:', err);
    }
}

// Wysyłanie wiadomości
dmForm.addEventListener('submit', async e => {
    e.preventDefault();
    if(!currentReceiverId) return alert('Wybierz użytkownika.');
    const formData = new FormData(dmForm);
    formData.append('receiver_id', currentReceiverId);
    try {
        const res = await fetch('/message', { method:'POST', body: formData });
        if(res.ok){
            dmForm.reset();
            loadMessages();
        } else {
            alert('Błąd przy wysyłaniu wiadomości.');
        }
    } catch(err) {
        console.error('Błąd przy wysyłaniu wiadomości:', err);
    }
});

// Auto-refresh czatu
setInterval(loadMessages, 3000);

// Init
(async function init() {
    await loadCurrentUser();
    loadUsers();
})();
