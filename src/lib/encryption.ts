import crypto from "crypto";
import fs from "fs";
import path from "path";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.startsWith("CHANGE_ME")) {
    throw new Error("ENCRYPTION_KEY ist nicht konfiguriert! Bitte in .env.local setzen.");
  }
  return Buffer.from(key, "hex");
}

/**
 * Encrypts a buffer and writes it to disk.
 * Format: [IV (16 bytes)] [Auth Tag (16 bytes)] [Encrypted Data]
 */
export function encryptAndSave(data: Buffer, filePath: string): void {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Ensure directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write: IV + Tag + Encrypted Data
  const output = Buffer.concat([iv, tag, encrypted]);
  fs.writeFileSync(filePath, output);
}

/**
 * Reads an encrypted file from disk and decrypts it.
 */
export function readAndDecrypt(filePath: string): Buffer {
  const key = getEncryptionKey();
  const fileData = fs.readFileSync(filePath);

  const iv = fileData.subarray(0, IV_LENGTH);
  const tag = fileData.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = fileData.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

/**
 * Deletes an encrypted file from disk.
 */
export function deleteEncryptedFile(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * Generates a unique file path for an upload.
 */
export function generateUploadPath(userId: string, side: "front" | "back"): string {
  const uploadDir = process.env.UPLOAD_DIR || "./data/uploads";
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(4).toString("hex");
  return path.join(uploadDir, userId, `${timestamp}-${side}-${randomSuffix}.enc`);
}
