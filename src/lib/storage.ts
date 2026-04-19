import { supabase } from '@/integrations/supabase/client';

export const getSignedFileUrl = async (path: string): Promise<string | null> => {
  const { data, error } = await supabase.storage
    .from('medical-files')
    .createSignedUrl(path, 3600); // 1 hour expiry
  if (error) return null;
  return data.signedUrl;
};

export const openSignedFile = async (fileUrl: string) => {
  // If it's already a full URL (legacy public URL), try to extract the path
  const path = fileUrl.includes('/object/public/medical-files/')
    ? fileUrl.split('/object/public/medical-files/')[1]
    : fileUrl;
  
  const signedUrl = await getSignedFileUrl(path);
  if (signedUrl) {
    window.open(signedUrl, '_blank');
  }
};
