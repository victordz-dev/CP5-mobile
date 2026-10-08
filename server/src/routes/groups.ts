import { Router, Request, Response } from 'express';
import { adminFirestore, adminDatabase } from '../services/firebaseAdmin';
import { authenticate, AuthenticatedRequest } from '../middleware/authenticate';

const router = Router();

// Synchronize member list from Firestore to RTDB
const syncGroupToRTDB = async (groupId: string, memberIds: string[]) => {
  const membersRecord: Record<string, boolean> = {};
  memberIds.forEach((uid: string) => {
    membersRecord[uid] = true;
  });
  await adminDatabase.ref(`chat_members/${groupId}`).set(membersRecord);
};

router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, photoUrl, memberLimit, notificationPolicy, memberIds } = req.body;
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const groupRef = adminFirestore.collection('groups').doc();
    const newGroup = {
      name,
      photoUrl,
      ownerId: user.uid,
      memberLimit,
      notificationPolicy,
      memberIds,
      id: groupRef.id,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const batch = adminFirestore.batch();
    batch.set(groupRef, newGroup);
    await batch.commit();

    await syncGroupToRTDB(groupRef.id, memberIds);

    res.status(200).json({ success: true, groupId: groupRef.id });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/join', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const groupRef = adminFirestore.collection('groups').doc(id as string);
    let finalMembers: string[] = [];
    
    await adminFirestore.runTransaction(async (transaction) => {
      const doc = await transaction.get(groupRef);
      if (!doc.exists) throw new Error('Group not found');
      
      const data = doc.data();
      if (!data) throw new Error('No data');
      
      const members = data.memberIds || [];
      if (members.includes(userId)) {
        finalMembers = members;
        return; // already there
      }
      
      if (members.length >= (data.memberLimit || 10)) {
        throw new Error('Group limit reached');
      }

      finalMembers = [...members, userId];
      transaction.update(groupRef, {
        memberIds: finalMembers,
        updatedAt: Date.now()
      });
    });

    await syncGroupToRTDB(id as string, finalMembers);
    res.status(200).json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error joining group' });
  }
});

router.post('/:id/leave', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const groupRef = adminFirestore.collection('groups').doc(id as string);
    let finalMembers: string[] = [];

    await adminFirestore.runTransaction(async (transaction) => {
      const doc = await transaction.get(groupRef);
      if (!doc.exists) throw new Error('Group not found');
      
      const data = doc.data();
      if (!data) throw new Error('No data');

      if (data.ownerId !== user.uid && userId !== user.uid) {
        throw new Error('Only the owner can remove other members');
      }

      const members = data.memberIds || [];
      finalMembers = members.filter((uid: string) => uid !== userId);

      transaction.update(groupRef, {
        memberIds: finalMembers,
        updatedAt: Date.now()
      });
    });

    await syncGroupToRTDB(id as string, finalMembers);
    res.status(200).json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error leaving group' });
  }
});

router.put('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const groupRef = adminFirestore.collection('groups').doc(id as string);
    const doc = await groupRef.get();
    if (!doc.exists || doc.data()?.ownerId !== user.uid) {
      res.status(403).json({ error: 'Only owner can update' });
      return;
    }

    await groupRef.update({
      ...updates,
      updatedAt: Date.now()
    });

    res.status(200).json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
