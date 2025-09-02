const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const db = new sqlite3.Database('./database.db');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'tajnyklucz',
    resave: false,
    saveUninitialized: true
}));
app.use(express.static(path.join(__dirname, 'public')));

// Uploady
const UPLOAD_DIR = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const storage = multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Tworzenie tabel
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        title TEXT,
        content TEXT,
        image TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER,
        user_id INTEGER,
        content TEXT,
        FOREIGN KEY(post_id) REFERENCES posts(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER,
        receiver_id INTEGER,
        content TEXT,
        image TEXT,
        FOREIGN KEY(sender_id) REFERENCES users(id),
        FOREIGN KEY(receiver_id) REFERENCES users(id)
    )`);
});

// Pomocnicza funkcja sesji
function getCurrentUser(req, res, callback) {
    if (!req.session.userId) return callback(null);
    db.get('SELECT id, username FROM users WHERE id = ?', [req.session.userId], (err, row) => {
        if (err || !row) return callback(null);
        callback(row);
    });
}

// --- Endpointy ---

// Sesja
app.get('/session', (req, res) => {
    getCurrentUser(req, res, (user) => {
        if (user) res.json(user);
        else res.json({ username: "NIEZALOGOWANY" });
    });
});

// Rejestracja
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, password], function(err) {
        if (err) return res.status(400).send('Błąd: ' + err.message);
        req.session.userId = this.lastID;
        res.sendStatus(200);
    });
});

// Logowanie
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT id FROM users WHERE username = ? AND password = ?', [username, password], (err, row) => {
        if (err) return res.status(500).send('Błąd');
        if (!row) return res.status(401).send('Niepoprawne dane');
        req.session.userId = row.id;
        res.sendStatus(200);
    });
});

// Wylogowanie
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.sendStatus(200);
});

// Dodawanie posta
app.post('/post', upload.single('image'), (req, res) => {
    if (!req.session.userId) return res.sendStatus(401);
    const { title, content } = req.body;
    const image = req.file ? '/uploads/' + req.file.filename : null;
    db.run('INSERT INTO posts (user_id, title, content, image) VALUES (?, ?, ?, ?)',
        [req.session.userId, title, content, image],
        (err) => err ? res.status(500).send(err.message) : res.sendStatus(200));
});

// Pobieranie feedu
app.get('/feed', (req, res) => {
    db.all(`SELECT posts.id, posts.title, posts.content, posts.image, posts.user_id, users.username
            FROM posts JOIN users ON posts.user_id = users.id
            ORDER BY posts.id DESC`, [], (err, posts) => {
        if (err) return res.json([]);
        if (!posts.length) return res.json([]);
        let count = 0;
        const postsWithComments = [];
        posts.forEach(post => {
            db.all(`SELECT comments.id, comments.content, comments.user_id, users.username
                    FROM comments JOIN users ON comments.user_id = users.id
                    WHERE post_id = ? ORDER BY comments.id ASC`, [post.id], (err, comments) => {
                postsWithComments.push({ ...post, comments });
                count++;
                if (count === posts.length) res.json(postsWithComments);
            });
        });
    });
});

// Dodawanie komentarza
app.post('/comment', (req, res) => {
    if (!req.session.userId) return res.sendStatus(401);
    const { post_id, content } = req.body;
    db.run('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)',
        [post_id, req.session.userId, content],
        (err) => err ? res.status(500).send(err.message) : res.sendStatus(200));
});

// Usuwanie posta
app.delete('/post/:id', (req, res) => {
    if (!req.session.userId) return res.sendStatus(401);
    db.run('DELETE FROM posts WHERE id = ? AND user_id = ?', [req.params.id, req.session.userId],
        function(err) { err ? res.sendStatus(500) : res.sendStatus(this.changes ? 200 : 403); });
});

// Usuwanie komentarza
app.delete('/comment/:id', (req, res) => {
    if (!req.session.userId) return res.sendStatus(401);
    db.run('DELETE FROM comments WHERE id = ? AND user_id = ?', [req.params.id, req.session.userId],
        function(err) { err ? res.sendStatus(500) : res.sendStatus(this.changes ? 200 : 403); });
});

// Lista użytkowników
app.get('/users', (req, res) => {
    if (!req.session.userId) return res.sendStatus(401);
    db.all('SELECT id, username FROM users WHERE id != ?', [req.session.userId], (err, rows) => {
        if(err) return res.status(500).send(err.message);
        res.json(rows);
    });
});

// Wiadomości
app.post('/message', upload.single('image'), (req, res) => {
    if (!req.session.userId) return res.sendStatus(401);
    const { receiver_id, content } = req.body;
    const image = req.file ? '/uploads/' + req.file.filename : null;
    db.run('INSERT INTO messages (sender_id, receiver_id, content, image) VALUES (?, ?, ?, ?)',
        [req.session.userId, receiver_id, content, image],
        (err) => err ? res.status(500).send(err.message) : res.sendStatus(200));
});

app.get('/messages/:userId', (req, res) => {
    if (!req.session.userId) return res.sendStatus(401);
    const otherId = req.params.userId;
    db.all(`SELECT messages.*, u1.username as sender, u2.username as receiver
            FROM messages
            JOIN users u1 ON messages.sender_id = u1.id
            JOIN users u2 ON messages.receiver_id = u2.id
            WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
            ORDER BY messages.id ASC`,
            [req.session.userId, otherId, otherId, req.session.userId],
            (err, rows) => err ? res.status(500).send(err.message) : res.json(rows));
});

// Usuwanie wiadomości
app.delete('/message/:id', (req, res) => {
    if (!req.session.userId) return res.sendStatus(401);
    db.run('DELETE FROM messages WHERE id = ? AND sender_id = ?', [req.params.id, req.session.userId],
        function(err) { err ? res.sendStatus(500) : res.sendStatus(this.changes ? 200 : 403); });
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server działa na porcie ${PORT}`));
