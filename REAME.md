# Membuat Struktur Proyek
/appProyek
|-- /views               <-- Untuk file-file HTML (EJS)
|   |-- login.ejs
|   |-- dashboard.ejs
|   |-- profil.ejs
|   |-- request_form.ejs
|   |-- view_requests.ejs
|   |-- view_request_detail.ejs
|   |-- partials/          <-- Untuk bagian yang berulang
|       |-- header.ejs
|       |-- footer.ejs
|       |-- bottom_nav.ejs
|-- /public              <-- Untuk file statis seperti CSS
|   |-- /css
|       |-- style.css
|-- app.js               <-- File utama server Node.js
|-- package.json         <-- Info & dependensi proyek
|-- credentials.json     <-- File kunci dari Google (JANGAN DIUPLOAD KE GIT)
|-- .env                 <-- Untuk menyimpan ID Spreadsheet

## File credential.json
Dapatkan Kredensial API (Service Account)
Aplikasi Node.js Anda akan bertindak sebagai "user" virtual untuk mengakses Sheet. Ini disebut Service Account.

Buka Google Cloud Console.

Buat proyek baru atau pilih yang sudah ada.

Di menu navigasi, pilih IAM & Admin > Service Accounts.

Klik + CREATE SERVICE ACCOUNT. Beri nama (misal: sheets-editor), lalu klik Create and Continue.

Pada bagian Role, pilih Editor. Klik Continue, lalu Done.

Anda akan kembali ke daftar Service Account. Cari akun yang baru Anda buat, klik ikon tiga titik di kolom Actions, lalu pilih Manage keys.

Klik ADD KEY > Create new key. Pilih JSON dan klik CREATE. File JSON akan ter-download.

PENTING: Ganti nama file JSON ini menjadi credentials.json dan simpan di folder proyek Node.js Anda nanti. Jangan pernah membagikan file ini secara publik.

Buka file credentials.json. Di dalamnya ada alamat email, contohnya: sheets-editor@nama-proyek-anda.iam.gserviceaccount.com. Salin alamat email ini.

Kembali ke Google Sheet Anda, klik tombol Share (Bagikan) di kanan atas. Tempelkan alamat email tadi dan berikan akses Editor. Klik Send.

## File .env
Buat file ini di root folder proyek. Isinya adalah ID dari Google Sheet Anda. Anda bisa mendapatkannya dari URL spreadsheet (bagian yang di-bold): https://docs.google.com/spreadsheets/d/1a2b3c4d5e_YOUR_SHEET_ID_HERE/edit#gid=0.

GOOGLE_SHEET_ID=1a2b3c4d5e_YOUR_SHEET_ID_HERE

# Struktur Spreadsheet
Sheet 1: Users
(Untuk data login pengguna)
| username | password | nama | jabatan | role |
| :--- | :--- | :--- | :--- | :--- |
| adit | 123 | Aditama Putra | Site Manager | user |
| budi | 123 | Budi Santoso | Admin Gudang | admin |
| user | 123 | User Biasa | Staff | user |

Sheet 2: Proyek
(Untuk daftar proyek yang bisa dipilih)
| namaProyek | kodeProyek |
| :--- | :--- |
| Proyek Aditama | ADI |
| Proyek Sentosa | SNT |
| Gedung Merdeka | GMK |

Sheet 3: RequestOrder
(Untuk menyimpan semua data request material)
| requestID | tanggal | project | material | qty | satuan | status | user |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| REQ/ADI/001 | 2025-07-30 | Proyek Aditama| Semen Tiga Roda | 20 | Sak | request | adit |
| REQ/ADI/001 | 2025-07-30 | Proyek Aditama| Pasir | 2 | Kubik | request | adit |

Sheet 4: HargaMaterial
namaMaterial	hargaSatuan	tokoBangunan	namaDaerah
Semen Tiga Roda	65000	TB Jaya Abadi	Jakarta Barat
Pasir Bangka	350000	TB Maju Mundur	Tangerang
Besi 10mm	75000	TB Sinar Logam	Jakarta Pusat

# Menjalankan App
npm init -y
npm install express express-session ejs google-spreadsheet dotenv
npm install google-auth-library
node app.js