/**
 * 类型定义 - 上传文件功能
 *
 * 根据 UX 设计稿 (iteration-2603111255) 和产品需求规格说明书实现
 *
 * 包含文件上传相关的接口定义
 */

/**
 * 上传文件信息（已上传到服务器）
 *
 * 后端响应格式 (backend.py 第1293-1302行):
 * {
 *   "file_id": "uuid",
 *   "filename": "report.pdf",
 *   "file_size": 2457600,
 *   "mime_type": "application/pdf",
 *   "uploaded_at": "2026-03-11T12:00:00Z"
 * }
 */
export interface UploadedFile {
  id: string;           // 文件唯一标识 (UUID) - 对应 file_id
  filename: string;     // 文件名 - 对应 filename
  size: number;         // 文件大小 (bytes) - 对应 file_size
  mimeType: string;     // MIME 类型 - 对应 mime_type
  uploadedAt: string;   // 上传时间 (ISO 8601) - 对应 uploaded_at
}

/**
 * 待发送文件（本地选择，未上传）
 */
export interface PendingFile {
  id: string;           // 临时唯一标识
  file: File;           // 原始 File 对象
  name: string;         // 文件名
  size: number;         // 文件大小 (bytes)
  type: string;         // MIME 类型
}

/**
 * 文件附件（消息中的附件）
 */
export interface FileAttachment {
  id: string;           // 文件标识
  name: string;         // 文件名
  size: number;         // 文件大小 (bytes)
  type: string;         // MIME 类型
  url?: string;         // 上传后的URL（可选）
}

/**
 * 文件上传配置
 */
export interface FileUploadConfig {
  maxFileSize: number;      // 最大文件大小 (bytes)
  allowedTypes: string[];   // 允许的 MIME 类型
  maxFiles: number;         // 最大文件数量
}

/**
 * 默认文件上传配置
 *
 * 根据产品需求规格说明书 (iteration-2603111255):
 * - 单文件最大: 100MB
 * - 单次上传最大: 3个文件
 * - 支持类型: PDF, DOCX, XLSX, TXT, CSV, JSON, 图片
 */
export const DEFAULT_FILE_CONFIG: FileUploadConfig = {
  maxFileSize: 100 * 1024 * 1024,  // 100MB (根据产品需求规格说明书)
  allowedTypes: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword',                                                       // .doc
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // .xlsx
    'application/vnd.ms-excel',                                                 // .xls
    'text/plain',
    'text/csv',
    'application/json',
    'image/png',
    'image/jpeg',
  ],
  maxFiles: 3,  // 单次最多上传3个文件
};

/**
 * 文件类型图标配置
 */
export interface FileIconConfig {
  icon: string;         // 图标名称
  color: string;        // Tailwind 颜色类
}

/**
 * 获取文件图标配置
 */
export function getFileIconConfig(mimeType: string): FileIconConfig {
  if (mimeType === 'application/pdf') {
    return { icon: 'FileText', color: 'text-red-400' };
  }
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return { icon: 'FileText', color: 'text-blue-400' };
  }
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
    return { icon: 'FileSpreadsheet', color: 'text-green-400' };
  }
  if (mimeType.startsWith('image/')) {
    return { icon: 'Image', color: 'text-purple-400' };
  }
  return { icon: 'File', color: 'text-gray-400' };
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * 获取文件扩展名
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
}

/**
 * 文件上下文（发送消息时携带）
 *
 * 根据 PRD (iteration-2603121000) 需求：
 * - file_ids: 上传文件的 ID 列表
 * - file_infos: 文件的详细信息列表
 */
export interface FileContext {
  file_ids: string[];        // 文件 ID 列表
  file_infos: FileAttachment[]; // 文件信息列表
}

/**
 * Skill 执行状态
 */
export type SkillExecutionStatus =
  | 'idle'         // 空闲
  | 'loading'      // 加载中
  | 'executing'    // 执行中
  | 'completed'    // 完成
  | 'failed';      // 失败

/**
 * Skill 执行信息（用于展示状态）
 */
export interface SkillExecutionInfo {
  skillName: string;          // Skill 名称
  status: SkillExecutionStatus; // 执行状态
  message?: string;           // 状态消息
  error?: string;             // 错误信息
  startedAt?: number;         // 开始时间戳
  finishedAt?: number;        // 结束时间戳
}
