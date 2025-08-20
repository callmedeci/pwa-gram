const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhY2Z3bmF2dXNtcXR1YmR0a2FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMDY4NjAsImV4cCI6MjA3MDU4Mjg2MH0.iALosAfpwYK8lMx3gpHj0NZ4RZdw5e6eYqD2vVdobyc';

const supabaseUrl = 'https://hacfwnavusmqtubdtkan.supabase.co';
const supabaseKey = SUPABASE_KEY;
const supabaseDB = supabase.createClient(supabaseUrl, supabaseKey);

async function saveSubscriptionToSupabase(newSub) {
  const subscriptionObject = {
    endpoint: newSub.endpoint,
    keys: {
      p256dh: arrayBufferToBase64(newSub.getKey('p256dh')),
      auth: arrayBufferToBase64(newSub.getKey('auth')),
    },
  };

  const { data, error } = await supabaseDB
    .from('subscriptions')
    .insert(subscriptionObject)
    .select()
    .single();

  if (error) throw new Error('Error saving subscription:', error);

  return data;
}

async function sendNotification(body) {
  const { data, error } = await supabaseDB.functions.invoke('rapid-processor', {
    body,
  });

  if (error) throw new Error('Error sending notification:', error);
  else console.log('Notification sent successfully:', data);
}

async function getAllPosts() {
  return supabaseDB
    .from('posts')
    .select('*')
    .then((data) => {
      if (data.error) throw new Error(data.error.message);
      else return data.data;
    });
}

async function createNewPost(newPost) {
  const imageName = `${Math.random()}-${newPost.image.name}`.replaceAll(
    '/',
    ''
  );
  const imagePath = `https://hacfwnavusmqtubdtkan.supabase.co/storage/v1/object/public/post-images/${imageName}`;

  const { data, error } = await supabaseDB
    .from('posts')
    .insert({ ...newPost, image: imagePath });

  if (error) throw new Error('Something bad happened!');

  const { _, storageError } = await supabaseDB.storage
    .from('post-images')
    .upload(imageName, newPost.image);

  if (storageError) {
    supabaseDB.from('posts').delete().eq('id', data.id);
    throw new Error(`Failed to store your image! ${storageError}`);
  }

  return data;
}
