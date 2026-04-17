          (function () {
            const INDUSTRY_MAP = {
              recycling_resource: '再生资源',
              commodity_wholesale: '商贸批发',
              manufacturing_general: '制造业',
              business_service: '商务服务',
              software_dev: '软件开发',
              other: '其他行业'
            };

            const PAGE_TITLES = {
              wb: '工作台',
              ve: '凭证录入',
              ob: '期初余额',
              pay: '工资核算',
              iv: '发票管理',
              rb: '报表中心',
              mc: '期末结账'
            };

            function byId(id) {
              return document.getElementById(id);
            }

            function setText(id, value) {
              const el = byId(id);
              if (el) el.textContent = value;
            }

            function readJson(key, fallback) {
              try {
                const raw = localStorage.getItem(key);
                return raw ? JSON.parse(raw) : fallback;
              } catch (e) {
                return fallback;
              }
            }

            function listAccounts() {
              const list = readJson('accountingAccounts', []);
              return Array.isArray(list) ? list : [];
            }

            function normalizeAccount(account) {
              if (!account || !account.id) return null;
              return {
                id: account.id,
                name: account.name || account.accountName || account.account_name || '',
                industry: account.industry || account.industryType || '',
                startDate: account.startDate || account.start_date || '',
                accountingSystem: account.accountingSystem || account.accounting_system || '',
                createTime: account.createTime || account.create_time || '',
                userId: account.userId || account.user_id || ''
              };
            }

            function saveCurrentAccount(account) {
              const normalized = normalizeAccount(account);
              if (!normalized) return null;
              localStorage.setItem('currentAccountId', normalized.id);
              localStorage.setItem('currentAccount', JSON.stringify(normalized));
              const list = listAccounts().filter(item => item && item.id !== normalized.id);
              list.unshift(normalized);
              localStorage.setItem('accountingAccounts', JSON.stringify(list));
              return normalized;
            }

            function getQueryAccountId() {
              return new URLSearchParams(location.search).get('accountId') || '';
            }

            function currentAccountId() {
              return getQueryAccountId() || localStorage.getItem('currentAccountId') || '';
            }

            function getCachedAccount() {
              const queryId = getQueryAccountId();
              const cachedCurrent = normalizeAccount(readJson('currentAccount', null));
              const allAccounts = listAccounts();

              if (queryId) {
                const hit = allAccounts.find(item => item && item.id === queryId);
                if (hit) return saveCurrentAccount(hit);
                if (cachedCurrent && cachedCurrent.id === queryId) return cachedCurrent;
                return { id: queryId, name: '', industry: '', startDate: '' };
              }

              const savedId = localStorage.getItem('currentAccountId');
              if (savedId) {
                const hit = allAccounts.find(item => item && item.id === savedId);
                if (hit) return saveCurrentAccount(hit);
              }

              return cachedCurrent;
            }

            function applyAccount(account) {
              const normalized = normalizeAccount(account) || getCachedAccount();
              if (!normalized) return;
              const name = normalized.name || '--';
              const period = String(normalized.startDate || normalized.createTime || '').slice(0, 7) || '--';
              const industry = INDUSTRY_MAP[normalized.industry] || normalized.industry || '--';

              setText('an', name);
              setText('ap', period);
              setText('ai', industry);
              setText('wbn', name + ' · ' + period);
              setText('ob-period', period);
              document.title = name === '--' ? '银河星辰会计核算V2' : name + ' - 银河星辰会计核算V2';
            }

            function loadAccountMeta() {
              const cached = getCachedAccount();
              applyAccount(cached);
              const accountId = currentAccountId();
              if (!accountId) return Promise.resolve(cached);
              if (cached && cached.id === accountId && cached.name) return Promise.resolve(cached);

              return fetch('/api/accounts/current?id=' + encodeURIComponent(accountId))
                .then(resp => resp.json())
                .then(result => {
                  if (!result || !result.success || !result.data) return cached;
                  const normalized = saveCurrentAccount(result.data);
                  applyAccount(normalized);
                  return normalized;
                })
                .catch(() => cached);
            }

            window.showTab = function (key) {
              document.querySelectorAll('.page').forEach(el => el.classList.remove('on'));
              const page = byId('p-' + key);
              if (page) page.classList.add('on');
              document.querySelectorAll('.nav [data-k],.tab[data-k]').forEach(el => {
                el.classList.toggle('on', el.dataset.k === key);
              });
              const title = PAGE_TITLES[key] || PAGE_TITLES.wb;
              setText('pt', '银河星辰会计核算V2 · ' + title);
            };

            window.askAI = function (question) {
              if (window.toggleChatPanel) window.toggleChatPanel();
              const input = byId('chatInput') || byId('chat-input');
              if (input) {
                input.value = question;
                input.focus();
                return;
              }
              alert(question);
            };

            window.guide = function () {
              showTab('ve');
              const tip = byId('gt');
              if (tip) {
                tip.textContent = 'AI步骤：整理单据→选择业务场景→生成凭证→试算平衡→审核→工资/报税/月结联动';
              }
              askAI('请按步骤输出本月做账流程，并包含工资核算');
            };

            window.prefill = function (scene) {
              const rows = {
                sale: [
                  ['销售废旧金属收入', '1002 银行存款', '客户', '320000.00', '0.00', '13%', '销项发票'],
                  ['销售废旧金属收入', '6001 主营业务收入', '项目部', '0.00', '283185.84', '13%', '收入确认']
                ],
                expense: [
                  ['报销运输装卸费', '6602 管理费用', '部门', '5800.00', '0.00', '9%', '报销单'],
                  ['支付运输装卸费', '1002 银行存款', '银行', '0.00', '5800.00', '9%', '付款回单']
                ],
                purchase: [
                  ['支付废旧物资采购款', '1403 原材料', '供应商', '86000.00', '0.00', '13%', '进项发票'],
                  ['支付废旧物资采购款', '1002 银行存款', '银行', '0.00', '86000.00', '13%', '付款回单']
                ],
                salary: [
                  ['计提本月工资', '6601 职工薪酬', '部门', '45000.00', '0.00', '', '工资表'],
                  ['计提本月工资', '2211 应付职工薪酬', '员工', '0.00', '45000.00', '', '工资表']
                ]
              };
              const notes = {
                sale: '本月销售废旧金属收入',
                expense: '本月费用报销',
                purchase: '本月采购付款',
                salary: '本月工资计提'
              };
              showTab('ve');
              const summaryInput = byId('vn');
              const sourceInput = byId('vs');
              const tbody = byId('vb');
              if (summaryInput) summaryInput.value = notes[scene] || notes.sale;
              if (sourceInput) sourceInput.value = scene === 'salary' ? '工资表/考勤表' : '销项发票/报销单/回单';
              if (tbody) {
                const targetRows = rows[scene] || rows.sale;
                tbody.innerHTML = targetRows.map(row => '<tr>' + row.map((cell, idx) => '<td><input value="' + String(cell).replace(/"/g, '&quot;') + '"></td>').join('') + '</tr>').join('');
              }
              rec();
              calc();
            };

            window.rec = function () {
              const summaryInput = byId('vn');
              const debitInput = byId('sj');
              const creditInput = byId('sk');
              const result = byId('gt');
              const summary = summaryInput ? summaryInput.value.trim() : '';
              let debit = '1002 银行存款';
              let credit = '6001 主营业务收入';
              let tip = '识别为销售收入场景。';

              if (/工资|薪酬/.test(summary)) {
                debit = '6601 职工薪酬';
                credit = '2211 应付职工薪酬';
                tip = '识别为工资薪酬场景。';
              } else if (/报销|差旅|办公|运输|装卸|费用/.test(summary)) {
                debit = '6602 管理费用';
                credit = '1002 银行存款';
                tip = '识别为费用报销场景。';
              } else if (/采购|购入|原料|材料|进货/.test(summary)) {
                debit = '1403 原材料';
                credit = '1002 银行存款';
                tip = '识别为采购付款场景。';
              }

              if (debitInput) debitInput.value = debit;
              if (creditInput) creditInput.value = credit;
              if (result) result.textContent = 'AI科目推荐：借 ' + debit + '；贷 ' + credit + '。' + tip;
            };

            window.calc = function () {
              const tbody = byId('vb');
              if (!tbody) return;
              let debit = 0;
              let credit = 0;
              tbody.querySelectorAll('tr').forEach(tr => {
                const inputs = tr.querySelectorAll('input');
                debit += Number(inputs[3] ? inputs[3].value : 0);
                credit += Number(inputs[4] ? inputs[4].value : 0);
              });
              const debitEl = byId('sd');
              const creditEl = byId('sc');
              const result = byId('gt');
              if (debitEl) debitEl.textContent = debit.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              if (creditEl) creditEl.textContent = credit.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              if (result) {
                result.textContent += Math.abs(debit - credit) < 0.01 ? ' 当前试算平衡。' : ' 当前借贷不平，请检查分录。';
              }
            };

            function collectOpeningRows() {
              return Array.from(document.querySelectorAll('#obBody tr')).map(tr => {
                const tds = tr.querySelectorAll('td');
                const input = tr.querySelector('input');
                return {
                  account_code: tds[0] ? tds[0].textContent.trim() : '',
                  account_name: tds[1] ? tds[1].textContent.trim() : '',
                  direction: tds[2] ? tds[2].textContent.trim() : '',
                  amount: Number(((input && input.value) || '0').replace(/,/g, '')),
                  auxiliary: tds[4] ? tds[4].textContent.trim() : ''
                };
              });
            }

            function loadOpeningBalances() {
              const accountId = currentAccountId();
              if (!accountId) return;
              fetch('/api/accounts/' + encodeURIComponent(accountId) + '/opening-balances')
                .then(resp => resp.json())
                .then(result => {
                  if (!result.success || !Array.isArray(result.data) || !result.data.length) return;
                  result.data.forEach((row, index) => {
                    const tr = document.querySelectorAll('#obBody tr')[index];
                    if (!tr) return;
                    const input = tr.querySelector('input');
                    if (input) input.value = Number(row.amount || 0).toFixed(2);
                  });
                })
                .catch(() => {});
            }

            function renderVoucherList(list) {
              const box = byId('voucherList');
              if (!box) return;
              if (!Array.isArray(list) || !list.length) {
                box.innerHTML = '暂无已保存凭证';
                return;
              }
              box.innerHTML = list.slice(0, 10).map(voucher => {
                const lines = Array.isArray(voucher.entries)
                  ? voucher.entries.map(entry => '<div style="padding:4px 0 0 8px">· ' + (entry.summary || '') + ' / ' + (entry.account_code || '') + ' ' + (entry.account_name || '') + ' / 借 ' + Number(entry.debit_amount || 0).toFixed(2) + ' / 贷 ' + Number(entry.credit_amount || 0).toFixed(2) + '</div>').join('')
                  : '';
                return '<div style="padding:12px;border:1px solid #e3edf6;border-radius:12px;background:#fbfdff;margin-bottom:10px">'
                  + '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><b>' + ((voucher.voucher_type || '记') + '-' + (voucher.voucher_no || '')) + '</b><span>' + ((voucher.date || '').slice(0, 10)) + '</span></div>'
                  + '<div style="margin-top:6px;color:#567086">' + (voucher.summary || '') + '｜金额 ' + Number(voucher.amount || 0).toFixed(2) + '</div>'
                  + lines
                  + '</div>';
              }).join('');
            }

            function loadVoucherStats() {
              const accountId = currentAccountId();
              if (!accountId) return;
              fetch('/api/accounts/' + encodeURIComponent(accountId) + '/vouchers')
                .then(resp => resp.json())
                .then(result => {
                  if (!result.success || !Array.isArray(result.data)) return;
                  setText('wbVoucherCount', String(result.data.length).padStart(2, '0'));
                  renderVoucherList(result.data);
                })
                .catch(() => {});
            }

            window.loadVoucherList = function () {
              loadVoucherStats();
            };

            window.saveVoucher = function () {
              const accountId = currentAccountId();
              if (!accountId) {
                alert('请先选择账套');
                return;
              }
              const rows = Array.from(document.querySelectorAll('#vb tr'));
              const first = rows[0] ? rows[0].querySelectorAll('input') : [];
              const second = rows[1] ? rows[1].querySelectorAll('input') : [];
              const grids = document.querySelectorAll('.g6');
              const topGrid = grids[0];
              const secondGrid = grids[1];
              const payload = {
                voucherNo: topGrid ? topGrid.querySelector('.f:nth-child(2) input').value : '',
                voucherType: topGrid ? topGrid.querySelector('.f select').value : '记',
                date: topGrid ? topGrid.querySelector('.f:nth-child(3) input').value : '',
                summary: byId('vn') ? byId('vn').value : '',
                debitAccount: first[1] ? first[1].value : '',
                creditAccount: second[1] ? second[1].value : '',
                amount: Number(first[3] ? first[3].value : 0),
                attachments: topGrid ? topGrid.querySelector('.f:nth-child(5) input').value : '',
                creator: secondGrid ? secondGrid.querySelector('.f input').value : '',
                auditor: secondGrid ? secondGrid.querySelectorAll('.f input')[1].value : '',
                entries: rows.map(tr => {
                  const inputs = tr.querySelectorAll('input');
                  return {
                    summary: inputs[0] ? inputs[0].value : '',
                    account: inputs[1] ? inputs[1].value : '',
                    debit: inputs[3] ? inputs[3].value : '0',
                    credit: inputs[4] ? inputs[4].value : '0'
                  };
                })
              };

              fetch('/api/accounts/' + encodeURIComponent(accountId) + '/vouchers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              })
                .then(resp => resp.json())
                .then(result => {
                  if (!result.success) {
                    alert(result.message || '保存失败');
                    return;
                  }
                  alert('凭证保存成功');
                  loadVoucherStats();
                })
                .catch(error => alert('保存凭证失败：' + error.message));
            };

            window.saveOpeningBalance = function () {
              const accountId = currentAccountId();
              if (!accountId) {
                alert('请先选择账套');
                return;
              }
              fetch('/api/accounts/' + encodeURIComponent(accountId) + '/opening-balances', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows: collectOpeningRows() })
              })
                .then(resp => resp.json())
                .then(result => {
                  if (!result.success) {
                    alert(result.message || '保存失败');
                    return;
                  }
                  alert('期初余额已保存，可开始后续凭证处理与日常核算。');
                })
                .catch(error => alert('保存期初余额失败：' + error.message));
            };

            document.querySelectorAll('.nav [data-k],.tab[data-k]').forEach(el => {
              el.onclick = function () {
                showTab(el.dataset.k);
              };
            });

            loadAccountMeta();
            loadOpeningBalances();
            loadVoucherStats();

            if (location.hash === '#payroll') {
              showTab('pay');
            } else if (location.hash === '#opening') {
              showTab('ob');
            } else {
              showTab('wb');
            }

            rec();
          })();