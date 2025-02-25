const mysql = require('mysql2');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { sub } = require('date-fns');
const seven = require('node-7z');
const dotenv = require('dotenv');
const { format } = require('date-fns-tz');

dotenv.config();

const dbConfig = {
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.DATABASE_NAME
};

const backupDir = process.env.BACKUP_DIR || 'C:\\nrcs_backup\\backups';

const createBackup = (dbConfig, backupDir) => {
    const now = new Date();
    const timestamp = format(now, 'yyyyMMdd_HHmmss', { timeZone: 'Asia/Kolkata' });
    const backupFile = path.join(backupDir, `backup_${timestamp}.sql`);
    const compressedFile = path.join(backupDir, `backup_${timestamp}.7z`);

    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const mysqldumpPath = `"C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump"`;
    const dumpCommand = `${mysqldumpPath} -h ${dbConfig.host} -u ${dbConfig.user} -p${dbConfig.password} ${dbConfig.database} > ${backupFile}`;
    
    exec(dumpCommand, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error creating backup: ${error.message}`);
            return;
        }
        console.log(`Backup file created: ${backupFile}`);

        // Compress the backup file
        compressFile(backupFile, compressedFile);

        if (stderr) {
            console.error(`mysqldump stderr: ${stderr}`);
        }
    });
};

const compressFile = (inputFile, outputFile) => {
    const zip = seven.add(outputFile, inputFile, {
        recursive: true,
        $bin: 'C:\\Program Files\\7-Zip\\7z.exe' // Adjust the path to 7z executable if necessary
    });

    zip.on('end', () => {
        console.log(`Compressed file created: ${outputFile}`);
        fs.unlinkSync(inputFile); // Delete the uncompressed SQL file
    });

    zip.on('error', (err) => {
        console.error(`Error compressing file: ${err}`);
    });
};

const deleteOldBackups = (backupDir, days) => {
    const cutoffDate = sub(new Date(), { days });
    fs.readdir(backupDir, (err, files) => {
        if (err) {
            console.error(`Error reading backup directory: ${err}`);
            return;
        }

        files.forEach(file => {
            const filePath = path.join(backupDir, file);
            fs.stat(filePath, (err, stats) => {
                if (err) {
                    console.error(`Error getting file stats for ${filePath}: ${err}`);
                    return;
                }

                if (stats.mtime < cutoffDate) {
                    fs.unlink(filePath, (err) => {
                        if (err) {
                            console.error(`Error deleting file ${filePath}: ${err}`);
                            return;
                        }
                        console.log(`Deleted old backup file: ${filePath}`);
                    });
                }
            });
        });
    });
};

createBackup(dbConfig, backupDir);
deleteOldBackups(backupDir, 3); // Delete files older than 3 days


// Schedule the backup and delete tasks
const cron = require('node-cron');

// cron.schedule('0 2 * * *', () => {
    cron.schedule('* * * * *', () => {
    console.log('Running the backup script...');
    createBackup(dbConfig, backupDir);
}, {
    scheduled: true,
    timezone: 'Asia/Kolkata'
});

// cron.schedule('0 3 * * *', () => {
    cron.schedule('* * * * *', () => {

    console.log('Running the delete script...');
    deleteOldBackups(backupDir, 3); // Delete files older than 3 days
}, {
    scheduled: true,
    timezone: 'Asia/Kolkata'
});

console.log('Backup and delete schedulers are running. Press Ctrl+C to exit.');
