import { Router, Response } from 'express';
import { adminDatabase, adminFirestore } from '../services/firebaseAdmin';
import { authenticate, AuthenticatedRequest } from '../middleware/authenticate';

const router = Router();

router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { conversationId, type } = req.body;
  const user = req.user;

  if (!user || !conversationId || !type) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  try {
    let memberIds: string[] = [];

    if (type === 'direct') {
      const snap = await adminFirestore.doc(`directConversations/${conversationId}`).get();
      if (!snap.exists) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }
      memberIds = snap.data()?.participantIds || [];
    } else if (type === 'group') {
      const snap = await adminFirestore.doc(`groups/${conversationId}`).get();
      if (!snap.exists) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }
      memberIds = snap.data()?.memberIds || [];
    } else {
      res.status(400).json({ error: 'Invalid type' });
      return;
    }

    // Verify if the caller is a member
    if (!memberIds.includes(user.uid)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // Sync to RTDB
    const updates: Record<string, boolean> = {};
    memberIds.forEach(id => {
      updates[id] = true;
    });

    await adminDatabase.ref(`chat_members/${conversationId}`).set(updates);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error syncing members:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/users', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const snap = await adminFirestore.collection('users').get();
    // Return only public info to populate the new chat list securely
    const users = snap.docs.map(doc => {
      const data = doc.data();
      return { uid: doc.id, name: data.name, email: data.email, photoUrl: data.photoUrl };
    });
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/users/profiles', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { userIds } = req.body;
  if (!userIds || !Array.isArray(userIds)) return;
  try {
    const users: any[] = [];
    for (const uid of userIds) {
      const snap = await adminFirestore.collection('users').doc(uid).get();
      if (snap.exists) {
        users.push({ uid: snap.id, ...snap.data() });
      }
    }
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
