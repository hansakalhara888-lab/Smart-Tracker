onAppReady(() =>  {
    const incomeEl = document.getElementById('report-income');
    const expenseEl = document.getElementById('report-expense');
    const openingEl = document.getElementById('report-opening');
    const savingsEl = document.getElementById('report-savings');
    const closingEl = document.getElementById('report-closing');
    const archiveList = document.getElementById('archive-list');
    const alertBox = document.getElementById('auto-save-alert');
    const transactions = getStorageData(KEYS.TRANSACTIONS);
    const nowKey = currentMonthKey();
    const formatRs = (amount) => formatMoney(amount);
    function monthLabel(key)  {
        const [y, m] = key.split('-').map(Number);
        return new Date(y, m - 1, 1).toLocaleDateString(undefined,  {
            month: 'long', year: 'numeric'
        });
    }
    function totalsForMonth(key)  {
        let income = 0;
        let expense = 0;
        let savings = 0;
        const items = [];

        transactions.forEach((tx) =>  {
            if (tx.type === 'transfer' || monthKeyFromDate(tx.date) !== key) return;

            const amount = Number(tx.amount) || 0;

            if (tx.type === 'income')  {
                income += amount;
            } else if (isSavingsDeposit(tx))  {
                savings += amount;
            } else if (tx.type === 'expense')  {
                expense += amount;
            }

            items.push(tx);
        });

        const openingBalance = totalNetBeforeMonth(key, transactions)
            + getWallets().reduce((sum, wallet) => sum + (Number(wallet.openingBalance) || 0), 0);

        return  {
            income,
            expense,
            savings,
            cashChange: income - expense - savings,
            openingBalance,
            closingBalance: openingBalance + income - expense - savings,
            items
        };
    }
    const current = totalsForMonth(nowKey);
    if (openingEl) openingEl.textContent = formatRs(current.openingBalance);
    if (incomeEl) incomeEl.textContent = formatRs(current.income);
    if (expenseEl) expenseEl.textContent = formatRs(current.expense);
    if (savingsEl) savingsEl.textContent = formatRs(current.savings);
    if (closingEl) closingEl.textContent = formatRs(current.closingBalance);
    const categoryTotals =  {
    };
    current.items.forEach((tx) =>  {
        if (tx.type !== 'expense' || isSavingsDeposit(tx)) return;
        const cat = tx.category || 'Other';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(tx.amount) || 0);
    });
    const categoryCanvas = document.getElementById('categoryChart');
    if (categoryCanvas && typeof Chart !== 'undefined' && Object.keys(categoryTotals).length)  {
        new Chart(categoryCanvas.getContext('2d'),  {
            type: 'doughnut', data:  {
                labels: Object.keys(categoryTotals), datasets: [{
                    data: Object.values(categoryTotals)
                }]
            }, options:  {
                responsive: true, plugins:  {
                    legend:  {
                        position: 'bottom'
                    }, title:  {
                        display: true, text: 'Current Expenses by Category'
                    }, tooltip:  {
                        callbacks:  {
                            label: (ctx) => `${ctx.label || ''}: ${formatRs(ctx.parsed)}`
                        }
                    }
                }
            }
        });
    }
    function buildLast6MonthsTrend()  {
        const labels = [], incomeData = [], expenseData = [];
        for (let i = 5; i >= 0; i--)  {
            const d = new Date();
            d.setDate(1);
            d.setMonth(d.getMonth() - i);
            const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            const totals = totalsForMonth(key);
            labels.push(d.toLocaleDateString(undefined,  {
                month: 'short', year: 'numeric'
            }));
            incomeData.push(totals.income);
            expenseData.push(totals.expense);
        }
        const canvas = document.getElementById('trendChart');
        const empty = document.getElementById('trend-empty');
        if (!canvas || typeof Chart === 'undefined') return;
        const hasAny = incomeData.some(Boolean) || expenseData.some(Boolean);
        if (!hasAny)  {
            if (empty) empty.style.display = 'block';
            return;
        }
        if (empty) empty.style.display = 'none';
        new Chart(canvas.getContext('2d'),  {
            type: 'line', data:  {
                labels, datasets: [{
                    label: 'Income', data: incomeData, tension: 0.25
                },  {
                    label: 'Expenses', data: expenseData, tension: 0.25
                }]
            }, options:  {
                responsive: true, maintainAspectRatio: false, interaction:  {
                    mode: 'index', intersect: false
                }, scales:  {
                    y:  {
                        beginAtZero: true, ticks:  {
                            callback: (v) => formatRs(v)
                        }
                    }
                }
            }
        });
    }
    function rebuildArchives()  {
        const oldArchives = getStorageData(KEYS.MONTHLY_REPORTS);
        const oldByMonth =  {
        };
        oldArchives.forEach((r) =>  {
            if (r.monthKey) oldByMonth[r.monthKey] = r;
            else if (r.monthYear) oldByMonth[r.monthYear] = r;
        });
        const monthKeys = [...new Set(transactions.map((tx) => monthKeyFromDate(tx.date)).filter((key) => key && key < nowKey))].sort();
        const archives = monthKeys.map((key) =>  {
            const t = totalsForMonth(key);
            const old = oldByMonth[key] || oldArchives.find((r) => r.monthYear === monthLabel(key));
            return  {
                id: old && old.id ? old.id : 'month-' + key,
                monthKey: key,
                monthYear: monthLabel(key),
                openingBalance: t.openingBalance,
                income: t.income,
                expense: t.expense,
                savings: t.savings,
                closingBalance: t.closingBalance,
                items: t.items,
                savedAt: new Date().toLocaleDateString()
            };
        });
        if (JSON.stringify(archives) !== JSON.stringify(oldArchives))  {
            setStorageData(KEYS.MONTHLY_REPORTS, archives);
            if (alertBox && archives.length)  {
                alertBox.textContent = 'Monthly archives checked and updated from your saved transactions.';
                alertBox.style.display = 'block';
            }
        }
        return archives;
    }
    function renderArchives(archives)  {
        archiveList.innerHTML = '';
        if (!archives.length)  {
            archiveList.innerHTML = '<li>No saved monthly report files found.</li>';
            return;
        }
        archives.slice().sort((a,b) => String(b.monthKey).localeCompare(String(a.monthKey))).forEach((report) =>  {
            const li = document.createElement('li');
            li.className = 'archive-card';
            li.innerHTML = `
        <div class="archive-main">
          <div>
            <strong>📅 ${report.monthYear}</strong><br>
            <span>Opening: ${formatRs(report.openingBalance)}</span> ·
            <span style="color:var(--success)">Income: ${formatRs(report.income)}</span> ·
            <span style="color:var(--danger)">Expenses: ${formatRs(report.expense)}</span> ·
            <span style="color:var(--primary-color)">Savings: ${formatRs(report.savings || 0)}</span><br>
            <strong>Closing balance: ${formatRs(report.closingBalance)}</strong> · ${report.items.length} transactions
          </div>
          <span class="archive-link">View Details ➔</span>
        </div>`;
            li.addEventListener('click', () =>  {
                window.location.href = `report-detail.html?id=${encodeURIComponent(report.id)}`;
            });
            archiveList.appendChild(li);
        });
    }
    buildLast6MonthsTrend();
    renderArchives(rebuildArchives());
    function monthDiffText(a,b,label)  {
        if (!a && !b) return `${label}: no data`;
        if (!a) return `${label}: ${formatRs(b)} in B`;
        const pct=((b-a)/Math.abs(a))*100;
        return `${label}: ${formatRs(a)} → ${formatRs(b)} (${pct>=0?'+':''}${pct.toFixed(1)}%)`;
    }
    const ca=document.getElementById('compare-a'), cb=document.getElementById('compare-b');
    const now=new Date();
    if(ca) {
        const d=new Date(now.getFullYear(),now.getMonth()-1,1);
        ca.value=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    }
    if(cb)cb.value=nowKey;
    const compareBtn=document.getElementById('compare-btn');
    if(compareBtn)compareBtn.onclick=()=> {
        const a=totalsForMonth(ca.value),b=totalsForMonth(cb.value),box=document.getElementById('compare-result');
        const ed=a.expense?((b.expense-a.expense)/a.expense*100):0;
        box.innerHTML=`<div class="metric-card"><small>Expenses</small><h3 class="${ed<=0?'comparison-good':'comparison-bad'}">${monthDiffText(a.expense,b.expense,'')}</h3></div><div class="metric-card"><small>Income</small><h3>${monthDiffText(a.income,b.income,'')}</h3></div><div class="metric-card"><small>Closing balance</small><h3>${formatRs(a.closingBalance)} → ${formatRs(b.closingBalance)}</h3></div>`;
    };
    let lastYearRows=[];
    function buildYear(year) {
        let ti=0,te=0,ts=0,best=null,worst=null;
        const rows=[];
        for(let m=0;m<12;m++) {
            const key=year+'-'+String(m+1).padStart(2,'0'),t=totalsForMonth(key);
            const sav = t.savings;
            const net = t.cashChange;
            rows.push({
                key,label:new Date(year,m,1).toLocaleDateString(undefined, {
                    month:'short'
                }),income:t.income,expense:t.expense,savings:sav,net,closing:t.closingBalance
            });
            ti+=t.income;
            te+=t.expense;
            ts+=sav;
            if(!best||net>best.net)best=rows[rows.length-1];
            if(!worst||net<worst.net)worst=rows[rows.length-1];
        }
        lastYearRows=rows;
        const cats= {
        };
        transactions
            .filter((t) => String(monthKeyFromDate(t.date)).startsWith(year + '-') && t.type === 'expense' && !isSavingsDeposit(t))
            .forEach((t) =>  {
                cats[t.category || 'Other'] = (cats[t.category || 'Other'] || 0) + (Number(t.amount) || 0);
            });
        const biggest=Object.entries(cats).sort((a,b)=>b[1]-a[1])[0];
        const box=document.getElementById('year-report-summary');
        box.innerHTML=`<div class="metric-card"><small>Total income</small><h3>${formatRs(ti)}</h3></div><div class="metric-card"><small>Total expenses</small><h3>${formatRs(te)}</h3></div><div class="metric-card"><small>Total savings deposits</small><h3>${formatRs(ts)}</h3></div><div class="metric-card"><small>Net cash change</small><h3>${formatRs(ti-te-ts)}</h3></div><div class="metric-card"><small>Best month</small><h3>${best?best.label+' '+formatRs(best.net):'-'}</h3></div><div class="metric-card"><small>Biggest category</small><h3>${biggest?biggest[0]+' '+formatRs(biggest[1]):'-'}</h3></div>`;
        const canvas=document.getElementById('year-chart');
        if(canvas&&typeof Chart!=='undefined') {
            if(window.yearChart)window.yearChart.destroy();
            window.yearChart=new Chart(canvas.getContext('2d'), {
                type:'bar',data: {
                    labels:rows.map(r=>r.label),datasets:[{
                        label:'Income',data:rows.map(r=>r.income)
                    }, {
                        label:'Expenses',data:rows.map(r=>r.expense)
                    }]
                },options: {
                    responsive:true,maintainAspectRatio:false
                }
            });
        }
        return  {
            ti,te,ts,rows
        };
    }
    const yi=document.getElementById('year-report-input');
    if(yi)yi.value=now.getFullYear();
    const ybtn=document.getElementById('year-report-btn');
    if(ybtn)ybtn.onclick=()=>buildYear(Number(yi.value));
    buildYear(now.getFullYear());
    const csvBtn=document.getElementById('export-csv-btn');
    if(csvBtn)csvBtn.onclick=()=> {
        if(!lastYearRows.length)buildYear(Number(yi.value));
        const lines=['Month,Income,Expenses,Savings,Cash Change,Closing Balance',...lastYearRows.map(r=>[r.key,r.income,r.expense,r.savings,r.net,r.closing].join(','))];
        const blob=new Blob([lines.join('\n')], {
            type:'text/csv'
        });
        const a=document.createElement('a');
        a.href=URL.createObjectURL(blob);
        a.download='SmartTracker-'+yi.value+'-report.csv';
        a.click();
        URL.revokeObjectURL(a.href);
    };
    const pdfBtn=document.getElementById('export-pdf-btn');
    if(pdfBtn)pdfBtn.onclick=()=> {
        if(!window.jspdf) {
            alert('PDF library did not load. Check internet connection.');
            return;
        }
        if(!lastYearRows.length)buildYear(Number(yi.value));
        const  {
            jsPDF
        }
        =window.jspdf;
        const doc=new jsPDF();
        doc.setFontSize(18);
        doc.text('SmartTracker Yearly Report '+yi.value,14,18);
        doc.setFontSize(10);
        let y=30;
        lastYearRows.forEach(r=> {
            doc.text(`${r.key}  Income ${formatRs(r.income)}  Expenses ${formatRs(r.expense)}  Cash Change ${formatRs(r.net)}  Closing ${formatRs(r.closing)}`,14,y);
            y+=7;
            if(y>280) {
                doc.addPage();
                y=20;
            }
        });
        doc.save('SmartTracker-'+yi.value+'-report.pdf');
    };
    function buildRangeReport() {
        const kind=document.getElementById('range-kind')?.value||'weekly';
        let from=document.getElementById('range-from')?.value||'',to=document.getElementById('range-to')?.value||'';
        const td=toLocalISODate(new Date());
        if(kind==='weekly') {
            to=td;
            from=addDaysISO(td,-6);
        } else if(kind==='monthly') {
            to=td;
            from=currentMonthKey()+'-01';
        }
        const f=document.getElementById('range-from'),t=document.getElementById('range-to');
        if(f)f.value=from;
        if(t)t.value=to;
        const items=transactions.filter(x=>x.type!=='transfer'&&toLocalISODate(x.date)>=from&&toLocalISODate(x.date)<=to);
        let income=0,expense=0,savings=0;
        const cats= {
        };
        items.forEach((x) =>  {
            const amount = Number(x.amount) || 0;

            if (x.type === 'income')  {
                income += amount;
                return;
            }

            if (isSavingsDeposit(x))  {
                savings += amount;
                return;
            }

            if (x.type === 'expense')  {
                expense += amount;
                cats[x.category || 'Other'] = (cats[x.category || 'Other'] || 0) + amount;
            }
        });
        const box=document.getElementById('range-report-summary');
        if(box)box.innerHTML=`<div class="metric-card"><small>Income</small><h3>${formatRs(income)}</h3></div><div class="metric-card"><small>Expenses</small><h3>${formatRs(expense)}</h3></div><div class="metric-card"><small>Cash change</small><h3>${formatRs(income-expense-savings)}</h3></div><div class="metric-card"><small>Savings deposits</small><h3>${formatRs(savings)}</h3></div><div class="metric-card"><small>Transactions</small><h3>${items.length}</h3></div>`;
        const cb=document.getElementById('range-category-breakdown');
        if(cb)cb.innerHTML='<h3 style="margin-top:1rem">Category breakdown</h3>'+Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="plan-row"><strong>${k}</strong> — ${formatRs(v)}</div>`).join('');
    }
    const rk=document.getElementById('range-kind');
    if(rk)rk.onchange=()=> {
        const custom=rk.value==='custom';
        document.getElementById('range-from').disabled=!custom;
        document.getElementById('range-to').disabled=!custom;
        buildRangeReport();
    };
    const rb=document.getElementById('range-report-btn');
    if(rb)rb.onclick=buildRangeReport;
    buildRangeReport();
});
