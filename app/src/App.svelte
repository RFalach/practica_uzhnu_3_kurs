<script>
  import { onDestroy } from 'svelte';
  import { signInWithPopup, signOut } from 'firebase/auth';
  import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
  import { auth, provider, db } from './firebase';
  import { itemsStore } from './stores/itemsStore';

  let user = null;
  let newItem = '';
  let loading = false;

  $: if (user) {
    itemsStore.init(user.uid);
  }

  onDestroy(() => itemsStore.destroy());

  async function login() {
    loading = true;
    try {
      const result = await signInWithPopup(auth, provider);
      user = result.user;
    } catch (error) {
      console.error(error);
    } finally {
      loading = false;
    }
  }

  async function logout() {
    await signOut(auth);
    user = null;
    itemsStore.destroy();
  }

  async function addItem(e) {
    e.preventDefault();
    if (!newItem.trim()) return;
    await addDoc(collection(db, `lists/${user.uid}/items`), {
      name: newItem,
      bought: false,
      createdAt: new Date()
    });
    newItem = '';
  }

  async function toggleBought(item) {
    await updateDoc(doc(db, `lists/${user.uid}/items/${item.id}`), {
      bought: !item.bought
    });
  }

  async function deleteItem(id) {
    await deleteDoc(doc(db, `lists/${user.uid}/items/${id}`));
  }

  $: boughtCount = $itemsStore.filter(i => i.bought).length;
  $: totalCount = $itemsStore.length;
  $: progress = totalCount > 0 ? (boughtCount / totalCount) * 100 : 0;
</script>

{#if !user}
  <div class="login-box">
    <div class="login-icon">🛒</div>
    <h1>Список покупок</h1>
    <p>Спільне редагування в реальному часі</p>
    <button class="google-btn" on:click={login} disabled={loading}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      {loading ? 'Завантаження...' : 'Увійти через Google'}
    </button>
  </div>
{:else}
  <div class="app">
    <div class="topbar">
      <span class="logo">🛒 Список покупок</span>
      <button class="user-btn" on:click={logout} aria-label="Вийти">
        <span class="avatar-letter">{user.displayName.charAt(0)}</span>
        <span class="avatar-name">{user.displayName}</span>
      </button>
    </div>

    {#if totalCount > 0}
      <div class="progress-wrap">
        <div class="progress-text">
          <span>Куплено {boughtCount} з {totalCount}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-thumb" style="width: {progress}%"></div>
        </div>
      </div>
    {/if}

    <div class="form-wrap">
      <form on:submit={addItem} class="form-row">
        <input
          type="text"
          bind:value={newItem}
          placeholder="Що купити?"
          class="field"
        />
        <button type="submit" class="btn" disabled={!newItem.trim()}>Додати</button>
      </form>
    </div>

    <div class="list-wrap">
      {#if $itemsStore.length === 0}
        <div class="empty">
          <span>📝</span>
          <p>Тут поки що порожньо</p>
        </div>
      {:else}
        {#each $itemsStore as item (item.id)}
          <div class="row" class:done={item.bought}>
            <button class="row-main" on:click={() => toggleBought(item)} aria-label="Перемкнути">
              <span class="dot" class:on={item.bought}>
                {#if item.bought}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                {/if}
              </span>
              <span class="text">{item.name}</span>
            </button>
            <button class="del" on:click|stopPropagation={() => deleteItem(item.id)} aria-label="Видалити">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        {/each}
      {/if}
    </div>
  </div>
{/if}

<style>
  .login-box {
    background: white;
    border-radius: 20px;
    padding: 40px 30px;
    text-align: center;
    max-width: 380px;
    width: 100%;
    margin: 80px auto;
    box-shadow: 0 10px 30px rgba(0,0,0,0.15);
  }
  .login-icon { font-size: 48px; margin-bottom: 12px; }
  .login-box h1 { font-size: 24px; margin-bottom: 8px; color: #1e293b; }
  .login-box p { color: #64748b; margin-bottom: 24px; }
  .google-btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: white;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    padding: 10px 22px;
    font-size: 15px;
    cursor: pointer;
    color: #1e293b;
  }
  .google-btn:hover { border-color: #6366f1; }

  .app {
    background: white;
    border-radius: 16px;
    max-width: 520px;
    width: 100%;
    margin: 40px auto;
    box-shadow: 0 10px 30px rgba(0,0,0,0.15);
    overflow: hidden;
  }

  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    gap: 12px;
  }
  .logo { font-weight: 600; font-size: 18px; }
  .user-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255,255,255,0.2);
    border: none;
    border-radius: 40px;
    padding: 6px 16px 6px 6px;
    color: white;
    cursor: pointer;
  }
  .avatar-letter {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: rgba(255,255,255,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 14px;
  }
  .avatar-name {
    font-size: 14px;
    max-width: 90px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .progress-wrap {
    padding: 16px 20px 8px;
  }
  .progress-text {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    color: #64748b;
    margin-bottom: 6px;
  }
  .progress-track {
    height: 6px;
    background: #e2e8f0;
    border-radius: 10px;
    overflow: hidden;
  }
  .progress-thumb {
    height: 100%;
    background: #6366f1;
    border-radius: 10px;
  }

  .form-wrap {
    padding: 12px 20px;
    border-bottom: 1px solid #f1f5f9;
  }
  .form-row {
    display: flex;
    gap: 8px;
    width: 100%;
  }
  .field {
    flex: 1 1 auto;
    min-width: 0;
    padding: 10px 12px;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    font-size: 15px;
    outline: none;
    background: #f8fafc;
  }
  .field:focus { border-color: #6366f1; background: white; }
  .btn {
    flex: 0 0 auto;
    padding: 10px 20px;
    background: #6366f1;
    color: white;
    border: none;
    border-radius: 10px;
    font-weight: 600;
    font-size: 15px;
    cursor: pointer;
  }
  .btn:disabled { opacity: 0.5; cursor: default; }

  .list-wrap { padding: 8px 20px 20px; }
  .empty { text-align: center; padding: 30px; color: #64748b; }
  .empty span { font-size: 36px; }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-radius: 10px;
    background: #f8fafc;
    margin-top: 4px;
  }
  .row-main {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1 1 auto;
    min-width: 0;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
  }
  .dot {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid #cbd5e1;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
  }
  .dot.on { background: #22c55e; border-color: #22c55e; }
  .text { font-size: 15px; color: #1e293b; word-break: break-word; }
  .done .text { text-decoration: line-through; color: #94a3b8; }
  .del {
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    flex: 0 0 auto;
    opacity: 0;
  }
  .row:hover .del { opacity: 1; }
  .del:hover { background: #fee2e2; color: #ef4444; }
</style>
