/** Shared by upload validation and admin upload guidance. */
export const PDF_UPLOAD_MAX_MB = 100;
export const MEDIA_UPLOAD_MAX_MB = 15;
export const UPLOAD_LIMIT_HINT = `PDFs: up to ${PDF_UPLOAD_MAX_MB} MB each. Photos: up to ${MEDIA_UPLOAD_MAX_MB} MB each. Upload large PDFs one at a time.`;

export function mediaUploadError(file: { name: string; type: string; size: number }): string | null {
  if (!file.size) return "Choose a file first";
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const maxMb = isPdf ? PDF_UPLOAD_MAX_MB : MEDIA_UPLOAD_MAX_MB;
  return file.size > maxMb * 1024 * 1024 ? `File is larger than ${maxMb} MB` : null;
}
