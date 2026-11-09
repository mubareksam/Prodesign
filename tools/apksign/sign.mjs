import { readFileSync, writeFileSync } from 'node:fs';
import { ApkSigner, SigningKey } from 'apk_sign_ts';

const [, , apkIn, apkOut, keyPath = 'key.pem', certPath = 'cert.pem'] = process.argv;
const apk = new Uint8Array(readFileSync(apkIn));
const keyPem = readFileSync(keyPath, 'utf8');
const certPem = readFileSync(certPath, 'utf8');
const signer = new ApkSigner({ signingKey: SigningKey.fromPEM(keyPem, certPem) });
const { signedApk } = await signer.sign(apk);
writeFileSync(apkOut, signedApk);
console.log(`signed ${apkIn} -> ${apkOut} (${signedApk.length} bytes)`);
