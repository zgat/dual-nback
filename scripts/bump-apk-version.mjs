import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = {
  packageJson: path.join(projectRoot, "package.json"),
  packageLock: path.join(projectRoot, "package-lock.json"),
  gradle: path.join(projectRoot, "android/app/build.gradle"),
  settingsModal: path.join(projectRoot, "app/game/SettingsModal.tsx"),
};

const [packageJsonText, packageLockText, gradleText, settingsModalText] = await Promise.all([
  readFile(files.packageJson, "utf8"),
  readFile(files.packageLock, "utf8"),
  readFile(files.gradle, "utf8"),
  readFile(files.settingsModal, "utf8"),
]);

const packageJson = JSON.parse(packageJsonText);
const packageLock = JSON.parse(packageLockText);
const versionMatch = /^(\d+)\.(\d+)\.(\d+)$/.exec(packageJson.version);
const versionCodeMatch = /versionCode\s+(\d+)/.exec(gradleText);
const versionNameMatch = /versionName\s+"([^"]+)"/.exec(gradleText);

if (!versionMatch || !versionCodeMatch || !versionNameMatch) {
  throw new Error("无法读取当前 APK 版本号");
}
if (versionNameMatch[1] !== packageJson.version) {
  throw new Error(`版本号不一致：package.json=${packageJson.version}，Gradle=${versionNameMatch[1]}`);
}

const nextVersion = `${versionMatch[1]}.${versionMatch[2]}.${Number(versionMatch[3]) + 1}`;
const nextVersionCode = Number(versionCodeMatch[1]) + 1;

packageJson.version = nextVersion;
packageLock.version = nextVersion;
packageLock.packages[""].version = nextVersion;

const nextGradle = gradleText
  .replace(/versionCode\s+\d+/, `versionCode ${nextVersionCode}`)
  .replace(/versionName\s+"[^"]+"/, `versionName "${nextVersion}"`);
const nextSettingsModal = settingsModalText.replace(
  /VERSION \d+\.\d+\.\d+/,
  `VERSION ${nextVersion}`,
);

if (nextSettingsModal === settingsModalText) {
  throw new Error("未找到应用内版本号显示");
}

await Promise.all([
  writeFile(files.packageJson, `${JSON.stringify(packageJson, null, 2)}\n`),
  writeFile(files.packageLock, `${JSON.stringify(packageLock, null, 2)}\n`),
  writeFile(files.gradle, nextGradle),
  writeFile(files.settingsModal, nextSettingsModal),
]);

process.stdout.write(`APK 版本已更新：${nextVersion}（构建 ${nextVersionCode}）\n`);
