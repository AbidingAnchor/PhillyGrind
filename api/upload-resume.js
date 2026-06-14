import fs from 'fs/promises';
import formidable from 'formidable';
import {
  getUserFromRequest,
  hasServerSupabaseConfig,
  requireMethod,
  sendJson,
  supabaseAdmin,
} from './_utils.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const profileSelect = 'id,name,bio,skills,availability,neighborhoods,resume_path,resume_url,avatar_url,created_at';

const ALLOWED_RESUME_MIME_TYPES = new Set([
  'application/pdf',
  'application/x-pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const MIME_TO_EXTENSION = {
  'application/pdf': 'pdf',
  'application/x-pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

const resumePathFor = (userId, extension) => `${userId}/resume.${extension}`;

function getUploadedFile(files) {
  const candidate = files.file ?? files.resume;
  if (!candidate) return null;
  return Array.isArray(candidate) ? candidate[0] : candidate;
}

function extensionForResume(uploadedFile) {
  const mimeType = uploadedFile.mimetype || '';
  const fromMime = MIME_TO_EXTENSION[mimeType];
  if (fromMime) return fromMime;

  const name = uploadedFile.originalFilename || '';
  const extension = name.split('.').pop()?.toLowerCase();
  if (['pdf', 'doc', 'docx'].includes(extension)) return extension;

  return null;
}

function parseMultipart(req) {
  const form = formidable({
    maxFileSize: MAX_FILE_SIZE,
    maxFiles: 1,
    allowEmptyFiles: false,
  });

  return form.parse(req);
}

export default async function handler(req, res) {
  if (!requireMethod(req, res)) return;

  if (!hasServerSupabaseConfig) {
    sendJson(res, 500, { error: 'Server Supabase configuration is missing.' });
    return;
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    sendJson(res, 401, { error: 'Authentication required.' });
    return;
  }

  let uploadedFile;

  try {
    const [, files] = await parseMultipart(req);
    uploadedFile = getUploadedFile(files);
  } catch (error) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      sendJson(res, 400, { error: 'Resume must be 5MB or smaller.' });
      return;
    }

    sendJson(res, 400, { error: error.message || 'Could not parse upload.' });
    return;
  }

  if (!uploadedFile) {
    sendJson(res, 400, { error: 'A resume file is required (.pdf, .doc, or .docx).' });
    return;
  }

  const mimeType = uploadedFile.mimetype || '';
  const extension = extensionForResume(uploadedFile);

  if (!ALLOWED_RESUME_MIME_TYPES.has(mimeType) || !extension) {
    sendJson(res, 400, { error: 'Resume must be a PDF or Word document (.pdf, .doc, .docx).' });
    return;
  }

  if (uploadedFile.size > MAX_FILE_SIZE) {
    sendJson(res, 400, { error: 'Resume must be 5MB or smaller.' });
    return;
  }

  const path = resumePathFor(user.id, extension);

  try {
    const fileBuffer = await fs.readFile(uploadedFile.filepath);
    const { error: uploadError } = await supabaseAdmin.storage
      .from('resumes')
      .upload(path, fileBuffer, {
        cacheControl: '3600',
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ resume_path: path, resume_url: path })
      .eq('id', user.id)
      .select(profileSelect)
      .single();

    if (profileError) throw profileError;

    sendJson(res, 200, {
      resume_path: path,
      resume_url: path,
      profile,
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Could not upload resume.' });
  } finally {
    if (uploadedFile?.filepath) {
      await fs.unlink(uploadedFile.filepath).catch(() => {});
    }
  }
}
