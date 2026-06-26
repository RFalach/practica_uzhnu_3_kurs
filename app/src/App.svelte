<script>
  import { onDestroy } from 'svelte';
  import { signInWithPopup, signOut } from 'firebase/auth';
  import { 
    collection, addDoc, updateDoc, doc, deleteDoc, 
    arrayUnion, arrayRemove, onSnapshot, query, where, getDocs, setDoc 
  } from 'firebase/firestore';
  import { auth, provider, db } from './firebase';
  import { listsStore } from './stores/listsStore';

  let user = null;
  let newItem = '';
  let currentListId = null;
  let currentList = null;
  let newListName = '';
  let shareEmail = '';
  let unsubscribeList = null;
  let membersData = [];

  $: if (user) {
    updateUserDoc(user);
    listsStore.init(user.uid);
  }

  onDestroy(() => {
    if (unsubscribeList) unsubscribeList();
    listsStore.destroy();
  });

  async function updateUserDoc(user) {
    try {
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email
      }, { merge: true });
    } catch (e) {
      console.error(e);
    }
  }

  async function login() {
    const result = await signInWithPopup(auth, provider);
    user = result.user;
  }

  async function logout() {
    await signOut(auth);
    user = null;
    currentListId = null;
    currentList = null;
    if (unsubscribeList) unsubscribeList();
    listsStore.destroy();
    membersData = [];
  }

  async function createList(e) {
    e.preventDefault();
    if (!newListName.trim()) return;
    await addDoc(collection(db, 'lists'), {
      name: newListName,
      owner: user.uid,
      members: [user.uid],
      items: [],
      createdAt: new Date()
    });
    newListName = '';
  }

  async function shareList(e) {
    e.preventDefault();
    if (!shareEmail.trim() || !currentListId || !currentList) return;
    
    const q = query(collection(db, 'users'), where('email', '==', shareEmail.trim()));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      alert('Користувача з таким email не знайдено');
      return;
    }
    const targetUid = snapshot.docs[0].id;
    if (currentList.members.includes(targetUid)) {
      alert('Користувач вже є у списку');
      return;
    }
    await updateDoc(doc(db, 'lists', currentListId), {
      members: arrayUnion(targetUid)
    });
    shareEmail = '';
  }

  async function removeMember(uid) {
    if (!currentListId || !currentList) return;
    await updateDoc(doc(db, 'lists', currentListId), {
      members: arrayRemove(uid)
    });
  }

  async function leaveList() {
    if (!currentListId || !currentList || !user) return;
    if (currentList.owner === user.uid) {
      alert('Власник не може покинути список');
      return;
    }
    if (!confirm('Покинути список?')) return;
    await updateDoc(doc(db, 'lists', currentListId), {
      members: arrayRemove(user.uid)
    });
    backToLists();
  }

  async function loadMembersData(members) {
    if (!members || members.length === 0) {
      membersData = [];
      return;
    }
    try {
      const q = query(collection(db, 'users'), where('uid', 'in', members));
      const snapshot = await getDocs(q);
      membersData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.error(e);
      membersData = [];
    }
  }

  $: if (currentList?.members) {
    loadMembersData(currentList.members);
  }

  async function addItem(e) {
    e.preventDefault();
    if (!newItem.trim() || !currentListId || !currentList) return;
    const newItemObj = {
      id: Date.now().toString(),
      name: newItem,
      bought: false,
      createdAt: new Date().toISOString(),
      addedBy: user.displayName
    };
    await updateDoc(doc(db, 'lists', currentListId), {
      items: arrayUnion(newItemObj)
    });
    newItem = '';
  }

  async function toggleBought(item) {
    if (!currentListId || !currentList) return;
    const updatedItems = currentList.items.map(i => {
      if (i.id === item.id) return { ...i, bought: !i.bought };
      return i;
    });
    await updateDoc(doc(db, 'lists', currentListId), { items: updatedItems });
  }

  async function deleteItem(itemId) {
    if (!currentListId || !currentList) return;
    const itemToRemove = currentList.items.find(i => i.id === itemId);
    if (!itemToRemove) return;
    await updateDoc(doc(db, 'lists', currentListId), {
      items: arrayRemove(itemToRemove)
    });
  }

  async function deleteList(listId) {
    if (!confirm('Видалити список?')) return;
    await deleteDoc(doc(db, 'lists', listId));
    if (currentListId === listId) {
      currentListId = null;
      currentList = null;
      if (unsubscribeList) {
        unsubscribeList();
        unsubscribeList = null;
      }
    }
  }

  function openList(listId) {
    currentListId = listId;
    if (unsubscribeList) unsubscribeList();
    const listRef = doc(db, 'lists', listId);
    unsubscribeList = onSnapshot(listRef, (snapshot) => {
      if (snapshot.exists()) {
        currentList = { id: snapshot.id, ...snapshot.data() };
      } else {
        currentList = null;
        currentListId = null;
      }
    });
  }

  function backToLists() {
    currentListId = null;
    currentList = null;
    if (unsubscribeList) {
      unsubscribeList();
      unsubscribeList = null;
    }
    membersData = [];
  }

  $: items = currentList?.items || [];
  $: boughtCount = items.filter(i => i.bought).length;
  $: totalCount = items.length;
</script>

{#if !user}
  <div class="login-screen">
    <div class="login-card">
      <h1>🛒 Список покупок</h1>
      <p>Спільне редагування в реальному часі</p>
      <button on:click={login}>Увійти через Google</button>
    </div>
  </div>
{:else if !currentListId}
  <div class="app">
    <div class="topbar">
      <h1>Мої списки</h1>
      <div class="user-area">
        <span class="user-avatar">{user.displayName.charAt(0)}</span>
        <span class="user-name">{user.displayName}</span>
        <button class="logout-btn" on:click={logout}>Вийти</button>
      </div>
    </div>

    <div class="content">
      <div class="card">
        <form on:submit={createList}>
          <input type="text" bind:value={newListName} placeholder="Назва нового списку..." />
          <button type="submit" disabled={!newListName.trim()}>Створити</button>
        </form>
      </div>

      <div class="card">
        {#if $listsStore.length === 0}
          <p class="empty">Немає жодного списку. Створіть перший!</p>
        {:else}
          <ul>
            {#each $listsStore as list (list.id)}
              <li>
                <div class="list-info" on:click={() => openList(list.id)} on:keypress={() => openList(list.id)} role="button" tabindex="0">
                  <span class="list-name">{list.name}</span>
                  <span class="list-meta">{list.owner === user.uid ? 'Власник' : 'Учасник'}</span>
                </div>
                {#if list.owner === user.uid}
                  <button class="del-btn" on:click|stopPropagation={() => deleteList(list.id)}>✕</button>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  </div>
{:else}
  <div class="app">
    <div class="topbar">
      <button class="back-btn" on:click={backToLists}>← Назад</button>
      <h1>{currentList?.name || 'Список'}</h1>
      <div class="user-area">
        <span class="user-avatar">{user.displayName.charAt(0)}</span>
        <span class="user-name">{user.displayName}</span>
        <button class="logout-btn" on:click={logout}>Вийти</button>
      </div>
    </div>

    <div class="content">
      {#if currentList?.owner === user.uid}
        <div class="card">
          <form on:submit={shareList}>
            <input type="email" bind:value={shareEmail} placeholder="Email користувача" />
            <button type="submit" disabled={!shareEmail.trim()}>Поділитися</button>
          </form>
        </div>
      {/if}

{#if membersData.length > 0}
  <div class="card">
    <h3>Учасники</h3>
    <ul>
      {#each membersData as member (member.id)}
        <li>
          <span>{member.displayName} ({member.email})</span>
          {#if currentList?.owner === user.uid && member.id !== user.uid}
            <button class="del-btn" on:click={() => removeMember(member.id)}>✕</button>
          {/if}
        </li>
      {/each}
    </ul>
    {#if currentList?.owner !== user.uid}
      <button class="leave-btn" on:click={leaveList}>Покинути список</button>
    {/if}
  </div>
{/if}

<div class="card">
  <form on:submit={addItem}>
    <input type="text" bind:value={newItem} placeholder="Додати товар..." />
    <button type="submit" disabled={!newItem.trim()}>Додати</button>
  </form>
</div>

<div class="card">
  {#if items.length === 0}
    <p class="empty">Тут поки що порожньо. Додайте перший товар.</p>
  {:else}
    <div class="stats">Куплено {boughtCount} з {totalCount}</div>
    <ul>
      {#each items as item (item.id)}
        <li class:done={item.bought}>
          <div class="item-left" on:click={() => toggleBought(item)} on:keypress={() => toggleBought(item)} role="button" tabindex="0">
            <span class="checkbox" class:checked={item.bought}>
          {#if item.bought}✓{/if}
            </span>
            <div class="item-details">
              <span class="item-name">{item.name}</span>
              <span class="item-addedby">Додав {item.addedBy || 'невідомо'}</span>
            </div>
          </div>
          <button class="del-btn" on:click={() => deleteItem(item.id)}>✕</button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
    </div>
  </div>
{/if}

<style>
  .login-screen { display: flex; justify-content: center; align-items: center; min-height: 80vh; }
  .login-card { background: white; border-radius: 12px; padding: 40px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.08); max-width: 380px; width: 100%; }
  .login-card h1 { margin: 0 0 8px; font-size: 24px; }
  .login-card p { color: #666; margin: 0 0 24px; font-size: 14px; }
  .login-card button { padding: 10px 28px; background: #4a6cf7; color: white; border: none; border-radius: 8px; font-size: 15px; cursor: pointer; }

  .app { max-width: 560px; margin: 0 auto; min-height: 100vh; }
  .topbar { background: #4a6cf7; color: white; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; }
  .topbar h1 { font-size: 18px; margin: 0; }
  .back-btn { background: rgba(255,255,255,0.2); border: none; color: white; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 14px; margin-right: 10px; }
  .user-area { display: flex; align-items: center; gap: 8px; }
  .user-avatar { width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,0.25); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; }
  .user-name { font-size: 13px; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .logout-btn { background: rgba(255,255,255,0.2); border: none; color: white; padding: 5px 12px; border-radius: 6px; font-size: 13px; cursor: pointer; }

  .content { padding: 16px; }
  .card { background: white; border-radius: 10px; padding: 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); margin-bottom: 12px; }
  form { display: flex; gap: 8px; }
  input { flex: 1; padding: 10px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; outline: none; }
  input:focus { border-color: #4a6cf7; }
  button[type="submit"] { padding: 10px 18px; background: #4a6cf7; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; white-space: nowrap; }
  button:disabled { opacity: 0.5; cursor: default; }

  .empty { text-align: center; color: #999; padding: 20px 0; margin: 0; }
  .stats { font-size: 13px; color: #888; margin-bottom: 10px; }

  ul { list-style: none; padding: 0; margin: 0; }
  li { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f2f2f2; }
  li:last-child { border-bottom: none; }
  .list-info { display: flex; align-items: center; gap: 10px; flex: 1; cursor: pointer; }
  .list-name { font-weight: 500; }
  .list-meta { font-size: 12px; color: #999; }
  .item-left { display: flex; align-items: center; gap: 10px; flex: 1; cursor: pointer; }
  .checkbox { width: 20px; height: 20px; border-radius: 4px; border: 2px solid #ccc; display: flex; align-items: center; justify-content: center; font-size: 12px; color: white; flex-shrink: 0; }
  .checkbox.checked { background: #4a6cf7; border-color: #4a6cf7; }
  .item-details { display: flex; flex-direction: column; }
  .item-name { font-size: 15px; }
  .item-addedby { font-size: 12px; color: #999; }
  .done .item-name { text-decoration: line-through; color: #aaa; }
  .done .item-addedby { text-decoration: none; color: #ccc; }
  .del-btn { background: none; border: none; color: #ccc; cursor: pointer; font-size: 16px; padding: 4px 8px; border-radius: 4px; }
  .del-btn:hover { color: #e74c3c; background: #fef0f0; }

  .leave-btn { margin-top: 10px; padding: 8px 16px; background: #f0f0f0; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; color: #e74c3c; }
  .leave-btn:hover { background: #fee; }

  h3 { margin: 0 0 10px; font-size: 16px; }
</style>
