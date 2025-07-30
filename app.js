const express = require('express');
const session = require('express-session');
const path = require('path');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Konfigurasi EJS sebagai view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware untuk parsing body dari form dan file statis
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Konfigurasi session
app.use(session({
    secret: 'secret-key-super-rahasia', // Ganti dengan secret key yang lebih kompleks
    resave: false,
    saveUninitialized: true,
    // Sesi berlaku selama 7 hari (7 hari * 24 jam * 60 menit * 60 detik * 1000 ms)
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } 
}));

// Setup koneksi Google Sheets
const serviceAccountAuth = new JWT({
    email: require('./credentials.json').client_email,
    key: require('./credentials.json').private_key.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);

// --- Middleware ---
// Middleware untuk memeriksa apakah user sudah login
const authMiddleware = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
};

// Middleware untuk memeriksa role user
const roleCheck = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.session.user.role)) {
            // Bisa redirect ke halaman 'unauthorized' atau dashboard dengan pesan error
            return res.status(403).send('Akses ditolak. Anda tidak memiliki hak untuk mengakses halaman ini.');
        }
        next();
    };
};


// --- Fungsi Bantuan ---
// Fungsi untuk mendapatkan tanggal hari ini dalam format YYYY-MM-DD
function getTodayDate() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}


// --- Routes ---
app.get('/', (req, res) => {
    if (req.session.user) {
        res.redirect('/dashboard');
    } else {
        res.redirect('/login');
    }
});

// Halaman Login
app.get('/login', (req, res) => {
    res.render('login', { error: req.query.error });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle['Users'];
        const rows = await sheet.getRows();
        const user = rows.find(row => row.get('username') === username && row.get('password') === password);

        if (user) {
            req.session.user = {
                username: user.get('username'),
                nama: user.get('nama'),
                jabatan: user.get('jabatan'),
                role: user.get('role')
            };
            res.redirect('/dashboard');
        } else {
            res.redirect('/login?error=1');
        }
    } catch (error) {
        console.error('Login error:', error);
        res.redirect('/login?error=2');
    }
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/dashboard');
        }
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});

// Dashboard
app.get('/dashboard', authMiddleware, (req, res) => {
    res.render('dashboard', { user: req.session.user });
});

// Halaman Profil
app.get('/profil', authMiddleware, (req, res) => {
    res.render('profil', { user: req.session.user, message: null });
});

app.post('/ubah-password', authMiddleware, async (req, res) => {
    const { new_password } = req.body;
    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle['Users'];
        const rows = await sheet.getRows();
        const userRow = rows.find(row => row.get('username') === req.session.user.username);
        
        if (userRow) {
            userRow.set('password', new_password);
            await userRow.save();
            res.render('profil', { user: req.session.user, message: 'Password berhasil diubah!' });
        } else {
            res.render('profil', { user: req.session.user, message: 'Gagal mengubah password.' });
        }
    } catch(e) {
        console.error(e);
        res.render('profil', { user: req.session.user, message: 'Terjadi kesalahan pada server.' });
    }
});


// Halaman Request Material
app.get('/request', authMiddleware, roleCheck(['user']), async (req, res) => {
    try {
        await doc.loadInfo();
        const projectsSheet = doc.sheetsByTitle['Proyek'];
        const projects = (await projectsSheet.getRows()).map(row => ({
            namaProyek: row.get('namaProyek'),
            kodeProyek: row.get('kodeProyek'),
        }));
        res.render('request_form', { user: req.session.user, projects });
    } catch (error) {
        console.error(error);
        res.status(500).send('Gagal memuat data proyek.');
    }
});

app.post('/request', authMiddleware, roleCheck(['user']), async (req, res) => {
    try {
        const { project, material, qty, satuan } = req.body;
        const [projectNama, projectKode] = project.split('|');

        await doc.loadInfo();
        const requestSheet = doc.sheetsByTitle['RequestOrder'];
        const rows = await requestSheet.getRows();

        // Generate ID baru
        const projectRequests = rows.filter(r => r.get('requestID').startsWith(`REQ/${projectKode}`));
        const lastIdNum = projectRequests.length > 0 ? Math.max(...projectRequests.map(r => parseInt(r.get('requestID').split('/').pop(), 10))) : 0;
        const newIdNum = (lastIdNum + 1).toString().padStart(3, '0');
        const newRequestID = `REQ/${projectKode}/${newIdNum}`;

        const today = getTodayDate();
        const user = req.session.user.username;
        const status = 'request';
        
        const newRows = [];
        // Cek jika material adalah array (lebih dari 1) atau string (hanya 1)
        if (Array.isArray(material)) {
            for (let i = 0; i < material.length; i++) {
                if (material[i] && qty[i]) { // Pastikan tidak kosong
                    newRows.push({
                        requestID: newRequestID,
                        tanggal: today,
                        project: projectNama,
                        material: material[i],
                        qty: qty[i],
                        satuan: satuan[i],
                        status: status,
                        user: user
                    });
                }
            }
        } else { // Hanya satu material
            if(material && qty) {
                newRows.push({
                    requestID: newRequestID,
                    tanggal: today,
                    project: projectNama,
                    material: material,
                    qty: qty,
                    satuan: satuan,
                    status: status,
                    user: user
                });
            }
        }

        if (newRows.length > 0) {
            await requestSheet.addRows(newRows);
        }

        res.redirect('/view-requests');

    } catch (error) {
        console.error('Submit request error:', error);
        res.status(500).send("Gagal menyimpan request.");
    }
});


// Halaman View Request
app.get('/view-requests', authMiddleware, async (req, res) => {
    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle['RequestOrder'];
        const rows = await sheet.getRows();
        
        // Filter request berdasarkan user yang login
        const userRequests = rows.filter(row => row.get('user') === req.session.user.username);
        
        // Kelompokkan berdasarkan requestID
        const groupedRequests = userRequests.reduce((acc, row) => {
            const id = row.get('requestID');
            if (!acc[id]) {
                acc[id] = {
                    id: id,
                    tanggal: row.get('tanggal'),
                    status: row.get('status'),
                    project: row.get('project')
                };
            }
            return acc;
        }, {});

        res.render('view_requests', { user: req.session.user, requests: Object.values(groupedRequests).reverse() });

    } catch (error) {
        console.error(error);
        res.status(500).send('Gagal memuat data request.');
    }
});


// Halaman Detail, Edit, dan Delete Request
app.get('/view-requests/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle['RequestOrder'];
        const rows = await sheet.getRows();

        const requestDetails = rows.filter(row => row.get('requestID') === id && row.get('user') === req.session.user.username);
        
        if (requestDetails.length === 0) {
            return res.status(404).send('Request tidak ditemukan atau Anda tidak memiliki akses.');
        }
        
        const canEditOrDelete = requestDetails[0].get('tanggal') === getTodayDate();

        const materials = requestDetails.map(row => ({
            material: row.get('material'),
            qty: row.get('qty'),
            satuan: row.get('satuan'),
            _rowNumber: row.rowNumber // Simpan nomor baris untuk edit/delete
        }));

        res.render('view_request_detail', {
            user: req.session.user,
            request: {
                id: id,
                tanggal: requestDetails[0].get('tanggal'),
                status: requestDetails[0].get('status'),
                project: requestDetails[0].get('project'),
            },
            materials: materials,
            canEditOrDelete: canEditOrDelete
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('Gagal memuat detail request.');
    }
});

app.post('/delete-request/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle['RequestOrder'];
        const rows = await sheet.getRows();

        const rowsToDelete = rows.filter(row => row.get('requestID') === id && row.get('user') === req.session.user.username);

        if (rowsToDelete.length > 0) {
            // Cek tanggal
            if (rowsToDelete[0].get('tanggal') !== getTodayDate()) {
                return res.status(403).send('Hanya bisa menghapus request yang dibuat pada hari yang sama.');
            }
            // Hapus baris satu per satu (API tidak mendukung batch delete by filter)
            for (const row of rowsToDelete.reverse()) { // Dibalik agar index tidak bergeser
                await row.delete();
            }
        }
        res.redirect('/view-requests');

    } catch (error) {
        console.error(error);
        res.status(500).send('Gagal menghapus request.');
    }
});

// Halaman Harga Material
app.get('/harga-material', authMiddleware, async (req, res) => {
    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle['HargaMaterial'];
        const rows = await sheet.getRows();

        // Ambil query pencarian dari URL (jika ada)
        const searchQuery = req.query.search ? req.query.search.toLowerCase() : '';

        let materials = rows.map(row => ({
            namaMaterial: row.get('namaMaterial'),
            hargaSatuan: row.get('hargaSatuan'),
            tokoBangunan: row.get('tokoBangunan'),
            namaDaerah: row.get('namaDaerah')
        }));

        // Jika ada query pencarian, filter datanya
        if (searchQuery) {
            materials = materials.filter(material => 
                material.namaMaterial.toLowerCase().includes(searchQuery)
            );
        }

        res.render('harga_material', { 
            user: req.session.user, 
            materials: materials,
            searchQuery: searchQuery // Kirim query kembali ke EJS untuk ditampilkan di input
        });

    } catch (error) {
        console.error('Gagal memuat harga material:', error);
        res.status(500).send('Gagal memuat data harga material.');
    }
});

// Jalankan server
app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});