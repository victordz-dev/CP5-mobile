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
    // Return only minimum public info to populate the new chat list securely
    const users = snap.docs.map(doc => {
      const data = doc.data();
      return { uid: doc.id, name: data.name, photoUrl: data.photoUrl };
    });
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

interface UserProfile {
  uid: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
  birthDate?: string;
  photoUrl?: string;
}

router.post('/users/profiles', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { userIds } = req.body;
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!userIds || !Array.isArray(userIds)) {
    res.status(400).json({ error: 'Missing or invalid userIds' });
    return;
  }
  
  try {
    const users: UserProfile[] = [];
    
    // Check direct conversations
    const directsSnap = await adminFirestore.collection('directConversations').where('participantIds', 'array-contains', user.uid).get();
    const sharedUsers = new Set<string>();
    directsSnap.forEach(doc => {
      const p = doc.data().participantIds || [];
      p.forEach((id: string) => sharedUsers.add(id));
    });

    // Check groups
    const groupsSnap = await adminFirestore.collection('groups').where('memberIds', 'array-contains', user.uid).get();
    groupsSnap.forEach(doc => {
      const m = doc.data().memberIds || [];
      m.forEach((id: string) => sharedUsers.add(id));
    });

    for (const uid of userIds) {
      if (uid === user.uid || sharedUsers.has(uid)) {
        const snap = await adminFirestore.collection('users').doc(uid).get();
        if (snap.exists) {
          users.push({ uid: snap.id, ...snap.data() } as UserProfile);
        }
      }
    }
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
