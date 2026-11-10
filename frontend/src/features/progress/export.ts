import { accountApi } from '@/services/endpoints';

/** 기록 내보내기 zip 내려받기 (오디오 포함 여부 선택) */
export async function downloadExport(audio: boolean) {
  const blob = await accountApi.exportZip(audio);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `malang-records-${new Date().toISOString().slice(0, 10)}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

