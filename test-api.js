const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const firebaseConfig = require('./firebaseConfig.json');

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function test() {
  try {
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;
    const apiUrl = (process.env.TEST_API_URL || 'https://cp5-mobile.onrender.com').replace(/\/+$/, '');
    if (!email || !password) {
      throw new Error('Configure TEST_USER_EMAIL e TEST_USER_PASSWORD antes de executar o teste.');
    }

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const token = await userCredential.user.getIdToken();
    console.log('Got token');
    const res = await fetch(`${apiUrl}/sync-members/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Body:', text);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}
test();
