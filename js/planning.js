onAppReady(() =>  {
    const qs=(id)=>document.getElementById(id);
    const money=formatMoney;
    const today=()=>toLocalISODate(new Date());
    const esc=(s)=>String(s||'').replace(/[&<>\"]/g,c=>({
        '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'
    }
    [c]));
    function walletOptions(selects) {
        const ws=getWallets();
        selects.forEach(id=> {
            const el=qs(id);
            if(!el)return;
            const old=el.value;
            el.innerHTML=ws.map(w=>`<option value="${esc(w.name)}">${esc(w.icon)} ${esc(w.name)}</option>`).join('');
            if(ws.some(w=>w.name===old))el.value=old;
        });
    }
    walletOptions(['rec-wallet','bill-wallet','sub-wallet','debt-wallet']);
    // Budgets
    function renderBudgets() {
        const list=getStorageData(KEYS.BUDGETS);
        const tx=getStorageData(KEYS.TRANSACTIONS).filter(t=>monthKeyFromDate(t.date)===currentMonthKey()&&t.type==='expense');
        const box=qs('budget-list');
        if(!list.length) {
            box.innerHTML='<p class="empty-state">No budgets yet.</p>';
            return;
        }
        box.innerHTML=list.map(b=> {
            const used=tx.filter(t=>t.category===b.category).reduce((s,t)=>s+(Number(t.amount)||0),0);
            const pct=Number(b.limit)?Math.round(used/Number(b.limit)*100):0;
            const cls=pct>=100?'danger':pct>=80?'warn':'';
            return `<div class="plan-row"><div class="plan-row-head"><div><h3>${esc(b.category)}</h3><div>${money(used)} / ${money(b.limit)} used · ${pct}%</div></div><button class="btn-small btn-danger" data-del-budget="${b.id}">Delete</button></div><div class="progress ${cls}" style="margin-top:.7rem"><span style="width:${Math.min(100,pct)}%"></span></div>${pct>=100?'<p class="badge danger" style="margin-top:.6rem">Budget exceeded</p>':pct>=80?'<p class="badge warn" style="margin-top:.6rem">80% warning</p>':''}</div>`
        }).join('');
        box.querySelectorAll('[data-del-budget]').forEach(b=>b.onclick=()=> {
            const item=list.find(x=>x.id===Number(b.dataset.delBudget));
            if(!item)return;
            if(!confirm('Are you sure you want to delete the budget for \"'+item.category+'\"?'))return;
            setStorageData(KEYS.BUDGETS,list.filter(x=>x.id!==Number(b.dataset.delBudget)));
            renderBudgets();
        });
    }
    qs('budget-form').onsubmit=e=> {
        e.preventDefault();
        const cat=qs('budget-category').value.trim();
        const limit=Number(qs('budget-limit').value);
        let list=getStorageData(KEYS.BUDGETS);
        const old=list.find(b=>b.category.toLowerCase()===cat.toLowerCase());
        if(old)old.limit=limit;
        else list.push({
            id:Date.now(),category:cat,limit,monthKey:null
        });
        setStorageData(KEYS.BUDGETS,list);
        e.target.reset();
        renderBudgets();
    };
    renderBudgets();
    // Recurring
    function renderRecurring() {
        const list=getStorageData(KEYS.RECURRING),box=qs('recurring-list');
        box.innerHTML=list.length?list.map(r=>`<div class="plan-row"><div class="plan-row-head"><div><h3>${esc(r.name)}</h3><span class="badge ${r.type==='income'?'success':'danger'}">${esc(r.type)}</span> ${money(r.amount)} · ${esc(r.frequency)} · next ${formatAppDate(r.nextDate)} · ${esc(r.wallet)}</div><div class="feature-actions"><button class="btn-small btn-secondary" data-toggle-rec="${r.id}">${r.active?'Pause':'Resume'}</button><button class="btn-small btn-danger" data-del-rec="${r.id}">Delete</button></div></div></div>`).join(''):'<p class="empty-state">No recurring transactions.</p>';
        box.querySelectorAll('[data-toggle-rec]').forEach(b=>b.onclick=()=> {
            const x=list.find(r=>r.id===Number(b.dataset.toggleRec));
            x.active=!x.active;
            setStorageData(KEYS.RECURRING,list);
            renderRecurring();
        });
        box.querySelectorAll('[data-del-rec]').forEach(b=>b.onclick=()=> {
            const item=list.find(r=>r.id===Number(b.dataset.delRec));
            if(!item)return;
            if(!confirm('Are you sure you want to delete recurring transaction \"'+item.name+'\"?'))return;
            setStorageData(KEYS.RECURRING,list.filter(r=>r.id!==Number(b.dataset.delRec)));
            renderRecurring();
        });
    }
    qs('recurring-form').onsubmit=e=> {
        e.preventDefault();
        const obj= {
            id:Date.now(),name:qs('rec-name').value.trim(),type:qs('rec-type').value,category:qs('rec-category').value.trim(),wallet:qs('rec-wallet').value,amount:Number(qs('rec-amount').value),frequency:qs('rec-frequency').value,nextDate:qs('rec-date').value,active:true
        };
        const list=getStorageData(KEYS.RECURRING);
        list.push(obj);
        setStorageData(KEYS.RECURRING,list);
        e.target.reset();
        walletOptions(['rec-wallet']);
        renderRecurring();
    };
    renderRecurring();
    // Bills
    function billStatus(b) {
        if(b.paid)return ['Paid','success'];
        const t=today();
        if(b.dueDate<t)return ['Overdue','danger'];
        if(b.dueDate===t)return ['Due Today','warn'];
        return ['Upcoming',''];
    }
    function renderBills() {
        const list=getStorageData(KEYS.BILLS),box=qs('bill-list');
        box.innerHTML=list.length?list.map(b=> {
            const st=billStatus(b);
            return `<div class="plan-row"><div class="plan-row-head"><div><h3>${esc(b.name)}</h3><span class="badge ${st[1]}">${st[0]}</span> ${money(b.amount)} · due ${formatAppDate(b.dueDate)} · ${esc(b.wallet)}${b.repeatMonthly?' · repeats monthly':''}</div><div class="feature-actions">${!b.paid?`<button class="btn-small" data-pay-bill="${b.id}">Mark Paid</button>`:''}<button class="btn-small btn-danger" data-del-bill="${b.id}">Delete</button></div></div></div>`
        }).join(''):'<p class="empty-state">No bills added.</p>';
        box.querySelectorAll('[data-pay-bill]').forEach(btn=>btn.onclick=()=> {
            const b=list.find(x=>x.id===Number(btn.dataset.payBill));
            if(!b)return;
            const available=getWalletAvailable(b.wallet);
            if(Number(b.amount)>available+1e-9) {
                alert('Not enough money in '+b.wallet+'. Available: '+money(available));
                return;
            }
            const tx=getStorageData(KEYS.TRANSACTIONS);
            tx.push({
                id:Date.now(),type:'expense',category:b.category||'Bills',account:b.wallet,amount:Number(b.amount),description:b.name,date:today(),sourceKind:'bill',sourceId:b.id
            });
            setStorageData(KEYS.TRANSACTIONS,tx);
            if(b.repeatMonthly) {
                b.dueDate=addMonthsISO(b.dueDate,1);
                b.paid=false;
                addCalendarEvent({
                    id:Date.now()+2,title:b.name,date:b.dueDate,time:'09:00',remindMinutes:1440,description:'Bill due: '+money(b.amount),amount:b.amount,type:'bill'
                });
            } else b.paid=true;
            setStorageData(KEYS.BILLS,list);
            renderBills();
        });
        box.querySelectorAll('[data-del-bill]').forEach(btn=>btn.onclick=()=> {
            const item=list.find(x=>x.id===Number(btn.dataset.delBill));
            if(!item)return;
            if(!confirm('Are you sure you want to delete bill \"'+item.name+'\"?'))return;
            setStorageData(KEYS.BILLS,list.filter(x=>x.id!==Number(btn.dataset.delBill)));
            renderBills();
        });
    }
    qs('bill-form').onsubmit=e=> {
        e.preventDefault();
        const list=getStorageData(KEYS.BILLS);
        const b= {
            id:Date.now(),name:qs('bill-name').value.trim(),amount:Number(qs('bill-amount').value),dueDate:qs('bill-date').value,category:qs('bill-category').value.trim()||'Bills',wallet:qs('bill-wallet').value,repeatMonthly:qs('bill-repeat').checked,paid:false
        };
        list.push(b);
        setStorageData(KEYS.BILLS,list);
        addCalendarEvent({
            id:Date.now()+1,title:b.name,date:b.dueDate,time:'09:00',remindMinutes:1440,description:'Bill due: '+money(b.amount),amount:b.amount,type:'bill'
        });
        e.target.reset();
        walletOptions(['bill-wallet']);
        renderBills();
    };
    renderBills();
    // Subscriptions
    function renderSubs() {
        const list=getStorageData(KEYS.SUBSCRIPTIONS),box=qs('subscription-list');
        let monthly=0,yearly=0;
        list.filter(s=>s.active!==false).forEach(s=> {
            const a=Number(s.amount)||0;
            if(s.cycle==='yearly') {
                yearly+=a;
                monthly+=a/12
            } else {
                monthly+=a;
                yearly+=a*12
            }
        });
        qs('subscription-summary').innerHTML=`<div class="subscription-estimates"><div class="metric-card"><small>Estimated monthly</small><h3>${money(monthly)}</h3></div><div class="metric-card"><small>Estimated yearly</small><h3>${money(yearly)}</h3></div></div><div class="subscription-add-action"><button type="submit" form="subscription-form">Add Subscription</button></div>`;
        box.innerHTML=list.length?list.map(s=>`<div class="plan-row"><div class="plan-row-head"><div><h3>${esc(s.name)}</h3>${money(s.amount)} / ${esc(s.cycle)} · next ${formatAppDate(s.nextDate)} · ${esc(s.wallet)} · <span class="badge ${s.active!==false?'success':''}">${s.active!==false?'Active':'Paused'}</span></div><div class="feature-actions"><button class="btn-small btn-secondary" data-toggle-sub="${s.id}">${s.active!==false?'Pause':'Resume'}</button><button class="btn-small btn-danger" data-del-sub="${s.id}">Delete</button></div></div></div>`).join(''):'<p class="empty-state">No subscriptions.</p>';
        box.querySelectorAll('[data-toggle-sub]').forEach(btn=>btn.onclick=()=> {
            const s=list.find(x=>x.id===Number(btn.dataset.toggleSub));
            s.active=s.active===false;
            setStorageData(KEYS.SUBSCRIPTIONS,list);
            renderSubs();
        });
        box.querySelectorAll('[data-del-sub]').forEach(btn=>btn.onclick=()=> {
            const item=list.find(x=>x.id===Number(btn.dataset.delSub));
            if(!item)return;
            if(!confirm('Are you sure you want to delete subscription \"'+item.name+'\"?'))return;
            setStorageData(KEYS.SUBSCRIPTIONS,list.filter(x=>x.id!==Number(btn.dataset.delSub)));
            renderSubs();
        });
    }
    qs('subscription-form').onsubmit=e=> {
        e.preventDefault();
        const list=getStorageData(KEYS.SUBSCRIPTIONS);
        list.push({
            id:Date.now(),name:qs('sub-name').value.trim(),amount:Number(qs('sub-amount').value),cycle:qs('sub-cycle').value,frequency:qs('sub-cycle').value,nextDate:qs('sub-date').value,wallet:qs('sub-wallet').value,category:'Subscriptions',type:'expense',autoRecord:qs('sub-auto').checked,active:true
        });
        setStorageData(KEYS.SUBSCRIPTIONS,list);
        e.target.reset();
        walletOptions(['sub-wallet']);
        renderSubs();
    };
    renderSubs();
    // Debts
    function renderDebts() {
        const list=getStorageData(KEYS.DEBTS),box=qs('debt-list');
        box.innerHTML=list.length?list.map(d=> {
            const total=Number(d.principal)*(1+(Number(d.interest)||0)/100);
            const remaining=Math.max(0,total-(Number(d.paid)||0));
            const pct=total?Math.round((Number(d.paid)||0)/total*100):0;
            return `<div class="plan-row"><div class="plan-row-head"><div><h3>${esc(d.name)}</h3><span class="badge ${d.type==='lent'?'success':'warn'}">${d.type==='lent'?'Owed to me':'I owe'}</span> Total ${money(total)} · Remaining ${money(remaining)}${d.dueDate?' · due '+formatAppDate(d.dueDate):''}</div><button class="btn-small btn-danger" data-del-debt="${d.id}">Delete</button></div><div class="progress" style="margin:.7rem 0"><span style="width:${Math.min(100,pct)}%"></span></div>${remaining>0?`<div class="feature-actions"><input style="max-width:170px" type="number" min="0.01" step="0.01" placeholder="Payment" data-debt-pay-input="${d.id}"><button class="btn-small" data-pay-debt="${d.id}">${d.type==='lent'?'Record received':'Record payment'}</button></div>`:'<span class="badge success">Completed</span>'}</div>`
        }).join(''):'<p class="empty-state">No debts or loans.</p>';
        box.querySelectorAll('[data-pay-debt]').forEach(btn=>btn.onclick=()=> {
            const d=list.find(x=>x.id===Number(btn.dataset.payDebt));
            const inp=box.querySelector(`[data-debt-pay-input="${d.id}"]`);
            const amt=Number(inp.value);
            if(!amt||amt<=0)return;
            const total=Number(d.principal)*(1+(Number(d.interest)||0)/100);
            const rem=Math.max(0,total-(Number(d.paid)||0));
            if(amt>rem+1e-9) {
                alert('Maximum remaining is '+money(rem));
                return;
            }
            if(d.type==='borrowed'&&amt>getWalletAvailable(d.wallet)+1e-9) {
                alert('Not enough money in '+d.wallet);
                return;
            }
            const tx=getStorageData(KEYS.TRANSACTIONS);
            tx.push({
                id:Date.now(),type:d.type==='borrowed'?'expense':'income',category:d.type==='borrowed'?'Debt Payment':'Debt Repayment',account:d.wallet,amount:amt,description:d.name,date:today(),sourceKind:'debt',sourceId:d.id
            });
            setStorageData(KEYS.TRANSACTIONS,tx);
            d.paid=(Number(d.paid)||0)+amt;
            d.payments=d.payments||[];
            d.payments.push({
                id:Date.now()+1,amount:amt,date:today()
            });
            setStorageData(KEYS.DEBTS,list);
            renderDebts();
        });
        box.querySelectorAll('[data-del-debt]').forEach(btn=>btn.onclick=()=> {
            const item=list.find(x=>x.id===Number(btn.dataset.delDebt));
            if(!item)return;
            if(!confirm('Are you sure you want to delete debt/loan \"'+item.name+'\"?'))return;
            setStorageData(KEYS.DEBTS,list.filter(x=>x.id!==Number(btn.dataset.delDebt)));
            renderDebts();
        });
    }
    qs('debt-form').onsubmit=e=> {
        e.preventDefault();
        const list=getStorageData(KEYS.DEBTS);
        list.push({
            id:Date.now(),name:qs('debt-name').value.trim(),type:qs('debt-type').value,principal:Number(qs('debt-principal').value),interest:Number(qs('debt-interest').value)||0,dueDate:qs('debt-date').value,wallet:qs('debt-wallet').value,paid:0,payments:[]
        });
        setStorageData(KEYS.DEBTS,list);
        e.target.reset();
        walletOptions(['debt-wallet']);
        renderDebts();
    };
    renderDebts();
    // Wallets
    function renderWallets() {
        const list=getWallets(),allTx=getStorageData(KEYS.TRANSACTIONS),balances=computeWalletBalances(allTx);
        const box=qs('wallet-list');
        box.innerHTML=list.map(w=> {
            const history=allTx.filter(t=>t.account===w.name||t.fromAccount===w.name||t.toAccount===w.name).slice(-5).reverse();
            return `<div class="wallet-mini"><div style="font-size:1.5rem">${esc(w.icon)}</div><h3>${esc(w.name)}</h3><p>${money(balances[w.name]||0)}</p><small class="muted">Opening: ${money(w.openingBalance||0)}</small><details style="margin-top:.6rem"><summary>Recent history (${allTx.filter(t=>t.account===w.name||t.fromAccount===w.name||t.toAccount===w.name).length})</summary>${history.length?history.map(t=>`<div style="font-size:.82rem;padding:.35rem 0;border-bottom:1px solid var(--border-color)">${formatAppDate(t.date)} · ${esc(t.description||t.category)} · ${money(t.amount)}</div>`).join(''):'<div class="muted">No transactions.</div>'}</details>${SMART_WALLETS.includes(w.name)?'<div class="muted" style="margin-top:.6rem;font-size:.8rem">Default wallet</div>':`<div class="feature-actions" style="margin-top:.6rem"><button class="btn-small btn-danger" data-del-wallet="${esc(w.id)}">Delete</button></div>`}</div>`
        }).join('');
        box.querySelectorAll('[data-del-wallet]').forEach(btn=>btn.onclick=()=> {
            const w=list.find(x=>String(x.id)===btn.dataset.delWallet);
            if(!w||SMART_WALLETS.includes(w.name))return;
            if(!confirm('Are you sure you want to delete wallet \"'+w.name+'\"?'))return;
            const used=getStorageData(KEYS.TRANSACTIONS).some(t=>t.account===w.name||t.fromAccount===w.name||t.toAccount===w.name);
            if(used) {
                alert('This wallet has transactions. Keep it so old records remain correct.');
                return;
            }
            saveWallets(list.filter(x=>String(x.id)!==btn.dataset.delWallet));
            walletOptions(['rec-wallet','bill-wallet','sub-wallet','debt-wallet']);
            renderWallets();
        });
    }
    qs('wallet-form').onsubmit=e=> {
        e.preventDefault();
        let list=getWallets();
        const name=qs('wallet-name').value.trim();
        if(list.some(w=>w.name.toLowerCase()===name.toLowerCase())) {
            alert('Wallet already exists.');
            return;
        }
        list.push({
            id:'wallet-'+Date.now(),name,icon:qs('wallet-icon').value.trim()||'👛',openingBalance:Number(qs('wallet-opening').value)||0
        });
        saveWallets(list);
        e.target.reset();
        qs('wallet-icon').value='👛';
        qs('wallet-opening').value='0';
        walletOptions(['rec-wallet','bill-wallet','sub-wallet','debt-wallet']);
        renderWallets();
    };
    renderWallets();
});
