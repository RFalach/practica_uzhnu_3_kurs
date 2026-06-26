import { writable } from 'svelte/store';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

function createItemsStore() {
  const { subscribe, set } = writable([]);
  let unsubscribe = null;

  return {
    subscribe,

    init(listId) {
      if (unsubscribe) unsubscribe();
      const q = query(collection(db, `lists/${listId}/items`), orderBy('createdAt'));
      unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        set(items);
      });
    },

    destroy() {
      if (unsubscribe) unsubscribe();
      set([]);
    }
  };
}

export const itemsStore = createItemsStore();
