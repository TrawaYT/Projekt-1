const feed = document.getElementById('feed');
const postForm = document.getElementById('postForm');
let currentUser = { id: null, username: "NIEZALOGOWANY" };

// Obiekt do przechowywania tymczasowych treści komentarzy
const draftComments = {}; // postId -> tekst komentarza

// Pobierz aktualnie zalogowanego użytkownika
async function loadCurrentUser() {
    try {
        const res = await fetch('/session');
        const data = await res.json();
        currentUser = data;
    } catch (err) {
        console.error("Błąd pobierania sesji:", err);
    }
}

// Wczytaj wszystkie posty
async function loadFeed() {
    try {
        const res = await fetch('/feed');
        let posts = await res.json();

        // Sortuj po ID, aby kolejność była stała
        posts.sort((a, b) => a.id - b.id);

        feed.innerHTML = '';

        posts.forEach(post => {
            const postDiv = document.createElement('div');
            postDiv.classList.add('post');

            const title = document.createElement('h3');
            title.textContent = post.title;

            const author = document.createElement('p');
            author.textContent = `Autor: ${post.username}`;

            const content = document.createElement('p');
            content.textContent = post.content;

            postDiv.appendChild(title);
            postDiv.appendChild(author);
            postDiv.appendChild(content);

            if (post.image) {
                const img = document.createElement('img');
                img.src = post.image;
                img.classList.add('post-image');
                postDiv.appendChild(img);
            }

            // Usuń post
            if (currentUser.id === post.user_id) {
                const delBtn = document.createElement('button');
                delBtn.textContent = "Usuń post";
                delBtn.classList.add('delete-btn');
                delBtn.addEventListener('click', async () => {
                    if (confirm("Na pewno chcesz usunąć ten post?")) {
                        const res = await fetch(`/post/${post.id}`, { method: 'DELETE' });
                        if (res.ok) loadFeed();
                        else alert("Nie udało się usunąć posta");
                    }
                });
                postDiv.appendChild(delBtn);
            }

            // Komentarze
            const commentsDiv = document.createElement('div');
            commentsDiv.classList.add('comments');

            post.comments.forEach(c => {
                const cDiv = document.createElement('div');
                cDiv.classList.add('comment');

                const textSpan = document.createElement('span');
                textSpan.textContent = `${c.username}: ${c.content}`;
                cDiv.appendChild(textSpan);

                // Usuń komentarz
                if (currentUser.id === c.user_id) {
                    const delCBtn = document.createElement('button');
                    delCBtn.textContent = "Usuń";
                    delCBtn.classList.add('delete-btn');
                    delCBtn.addEventListener('click', async () => {
                        if (confirm("Na pewno chcesz usunąć komentarz?")) {
                            const res = await fetch(`/comment/${c.id}`, { method: 'DELETE' });
                            if (res.ok) loadFeed();
                            else alert("Nie udało się usunąć komentarza");
                        }
                    });
                    cDiv.appendChild(delCBtn);
                }

                commentsDiv.appendChild(cDiv);
            });

            // Formularz dodawania komentarza
            const cForm = document.createElement('form');
            cForm.classList.add('comment-form');

            const cInput = document.createElement('input');
            cInput.type = 'text';
            cInput.placeholder = 'Napisz komentarz';
            cInput.required = true;
            cInput.classList.add('comment-input');

            // Przywracanie treści komentarza z draftComments
            cInput.value = draftComments[post.id] || '';

            const cBtn = document.createElement('button');
            cBtn.type = 'submit';
            cBtn.textContent = 'Wyślij';
            cBtn.classList.add('comment-btn');

            // Aktualizuj draft podczas wpisywania
            cInput.addEventListener('input', () => {
                draftComments[post.id] = cInput.value;
            });

            cForm.appendChild(cInput);
            cForm.appendChild(cBtn);

            cForm.addEventListener('submit', async e => {
                e.preventDefault();
                if (!cInput.value.trim()) return;
                const res = await fetch('/comment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ post_id: post.id, content: cInput.value })
                });
                if (res.ok) {
                    // Po wysłaniu usuń zapisany draft
                    delete draftComments[post.id];
                    cInput.value = '';
                    loadFeed();
                } else {
                    alert("Błąd dodawania komentarza");
                }
            });

            postDiv.appendChild(commentsDiv);
            postDiv.appendChild(cForm);

            feed.appendChild(postDiv);
        });
    } catch (err) {
        console.error("Błąd ładowania feedu:", err);
    }
}

// Wysyłanie postów
if (postForm) {
    postForm.addEventListener('submit', async e => {
        e.preventDefault();
        const formData = new FormData(postForm);
        const res = await fetch('/post', { method: 'POST', body: formData });
        if (res.ok) {
            postForm.reset();
            loadFeed();
        } else {
            alert("Błąd dodawania posta");
        }
    });
}

// Auto-refresh co 5 sekund
setInterval(loadFeed, 5000);

// Init
(async function init() {
    await loadCurrentUser();
    loadFeed();
})();
