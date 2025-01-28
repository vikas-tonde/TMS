import crypto from 'crypto';
import prisma from '../DB/db.config.js';

const algorithm = 'aes-256-cbc';
// const key = crypto.randomBytes(32);  // Generate a random key
const key = Buffer.from(process.env.CIPHER_KEY, 'hex');
// Derive IV from a password (or some other secret) using PBKDF2
function deriveIv(password) {
    return crypto.pbkdf2Sync(password, 'salt', 100000, 16, 'sha256');
}

// Encrypt function using PBKDF2-derived IV
export function encrypt(text, password) {
    const iv = deriveIv(password);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Return IV and encrypted data concatenated as a single string
    return iv.toString('hex') + encrypted;
}

// Decrypt function using PBKDF2-derived IV
export function decrypt(encryptedData) {
    // Extract the first 32 characters as the IV (16 bytes, 32 hex chars)
    const iv = Buffer.from(encryptedData.slice(0, 32), 'hex');
    const encryptedText = encryptedData.slice(32);

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');    
    return decrypted;
}
// Usage Example
// const text = 'qcvjgtmgcsthlysd';
// const password = 'T50496';

// const encrypted = encrypt(text, password);
// console.log('Encrypted:', encrypted);
//  await prisma.user.update({
//     where: { employeeId: 'T50496' },
//     data: {
//         appPassword: encrypted
//     }
// });
// const decrypted = decrypt(encrypted, 'T50496');
// console.log('Decrypted:', decrypted);
