import { Router, Request, Response } from 'express';
import { adminFirestore, adminDatabase } from '../services/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { authenticate, AuthenticatedRequest } from '../middleware/authenticate';

const router = Router();

const validPolicies = ['all_group_messages', 'mentioned_members', 'direct_messages_only', 'disabled'];

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

    if (typeof memberLimit !== 'number' || !Number.isInteger(memberLimit) || memberLimit < 2) {
      res.status(400).json({ error: 'memberLimit deve ser um número inteiro maior ou igual a 2' });
      return;
    }
    if (!validPolicies.includes(notificationPolicy)) {
      res.status(400).json({ error: 'notificationPolicy inválida' });
      return;
    }
    if (!Array.isArray(memberIds) || new Set(memberIds).size !== memberIds.length || memberIds.length < 2 || memberIds.length > memberLimit) {
      res.status(400).json({ error: 'memberIds inválido (mínimo 2, máximo ' + memberLimit + ', IDs únicos)' });
      return;
    }
    if (!memberIds.includes(user.uid)) {
      res.status(400).json({ error: 'O dono deve estar incluso em memberIds' });
      return;
    }

    const usersSnap = await adminFirestore.collection('users').where(FieldValue.documentId(), 'in', memberIds).get();
    if (usersSnap.size !== memberIds.length) {
      res.status(400).json({ error: 'Um ou mais usuários informados não existem no sistema.' });
      return;
    }

    const groupRef = adminFirestore.collection('groups').doc();
    const newGroup = {
      name,
      photoUrl: photoUrl || '',
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

    try {
      await syncGroupToRTDB(groupRef.id, memberIds);
    } catch (e) {
      await groupRef.delete();
      throw new Error('Falha ao sincronizar com RTDB. Revertendo criação.');
    }

    res.status(200).json({ success: true, groupId: groupRef.id });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message || 'Internal server error' });
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

    const userSnap = await adminFirestore.collection('users').doc(userId).get();
    if (!userSnap.exists) {
      res.status(400).json({ error: 'O usuário informado não existe no sistema.' });
      return;
    }

    const groupRef = adminFirestore.collection('groups').doc(id as string);
    let finalMembers: string[] = [];
    
    await adminFirestore.runTransaction(async (transaction) => {
      const doc = await transaction.get(groupRef);
      if (!doc.exists) throw new Error('Group not found');
      
      const data = doc.data();
      if (!data) throw new Error('No data');

      if (data.ownerId !== user.uid) {
        throw new Error('Only the owner can add members');
      }
      
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

    try {
      await syncGroupToRTDB(id as string, finalMembers);
    } catch (e) {
      // Manual rollback
      await adminFirestore.collection('groups').doc(id as string).update({
        memberIds: FieldValue.arrayRemove(userId)
      });
      throw new Error('Falha na sincronização do RTDB. Revertido.');
    }

    res.status(200).json({ success: true });
  } catch (err: unknown) {
    res.status(400).json({ error: (err as Error).message || 'Error joining group' });
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
      
      if (data.ownerId === userId) {
        throw new Error('O dono não pode sair sem transferir a propriedade do grupo.');
      }
      
      if (members.length <= 2 && members.includes(userId)) {
        throw new Error('Um grupo não pode ter menos de 2 membros. Delete o grupo se desejar encerra-lo.');
      }

      finalMembers = members.filter((uid: string) => uid !== userId);

      transaction.update(groupRef, {
        memberIds: finalMembers,
        updatedAt: Date.now()
      });
    });

    try {
      await syncGroupToRTDB(id as string, finalMembers);
    } catch (e) {
      // Manual rollback
      await adminFirestore.collection('groups').doc(id as string).update({
        memberIds: FieldValue.arrayUnion(userId)
      });
      throw new Error('Falha na sincronização do RTDB. Revertido.');
    }

    res.status(200).json({ success: true });
  } catch (err: unknown) {
    res.status(400).json({ error: (err as Error).message || 'Error leaving group' });
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

    // Filter restricted fields
    delete updates.memberIds;
    delete updates.ownerId;
    delete updates.id;
    delete updates.createdAt;

    const groupRef = adminFirestore.collection('groups').doc(id as string);
    
    await adminFirestore.runTransaction(async (transaction) => {
      const doc = await transaction.get(groupRef);
      if (!doc.exists || doc.data()?.ownerId !== user.uid) {
        throw new Error('Apenas o dono pode atualizar');
      }
      const data = doc.data()!;

      if (updates.memberLimit !== undefined) {
        if (typeof updates.memberLimit !== 'number' || !Number.isInteger(updates.memberLimit) || updates.memberLimit < data.memberIds.length) {
          throw new Error('memberLimit inválido (deve ser inteiro) ou menor que a quantidade atual de membros');
        }
      }
      
      if (updates.notificationPolicy !== undefined && !validPolicies.includes(updates.notificationPolicy)) {
        throw new Error('notificationPolicy inválida');
      }

      transaction.update(groupRef, {
        ...updates,
        updatedAt: Date.now()
      });
    });

    res.status(200).json({ success: true });
  } catch (err: unknown) {
    res.status(400).json({ error: (err as Error).message || 'Internal server error' });
  }
});

export default router;
