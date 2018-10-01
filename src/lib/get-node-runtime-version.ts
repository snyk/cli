
export default function getRuntimeVersion(): number {
  return parseInt(process.version.slice(1).split('.')[0], 10);
}
