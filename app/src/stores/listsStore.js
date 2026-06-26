import { writable } from 'svelte/store';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

function createListsStore() {
  const { subscribe, set } = writable([]);
  let unsubscribe = null;

  return {
    subscribe,

    init(uid) {
      if (unsubscribe) unsubscribe();

      const listsMap = new Map();

      const ownedQuery = query(
        collection(db, 'lists'),
        where('owner', '==', uid)
      );

      const memberQuery = query(
        collection(db, 'lists'),
        where('members', 'array-contains', uid)
      );

      function updateStore() {
        const lists = Array.from(listsMap.values());
        lists.sort((a, b) => {
          const timeA = a.createdAt?.toMillis?.() || 0;
          const timeB = b.createdAt?.toMillis?.() || 0;
          return timeB - timeA;
        });
        set(lists);
      }

      const unsubscribeOwned = onSnapshot(ownedQuery, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'removed') {
            listsMap.delete(change.doc.id);
          } else {
            listsMap.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
          }
        });
        updateStore();
      });

      const unsubscribeMember = onSnapshot(memberQuery, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'removed') {
            listsMap.delete(change.doc.id);
          } else {
            listsMap.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
          }
        });
        updateStore();
      });

      unsubscribe = () => {
        unsubscribeOwned();
        unsubscribeMember();
      };
    },

    destroy() {
      if (unsubscribe) unsubscribe();
      set([]);
    }
  };
}

export const listsStore = createListsStore();
