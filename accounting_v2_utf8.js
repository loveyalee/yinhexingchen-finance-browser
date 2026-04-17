(function () {
  const App = {
    config: {
      industryMap: {
        recycling_resource: '再生资源',
        commodity_wholesale: '商贸批发',
        manufacturing_general: '制造业',
        business_service: '商务服务',
        software_dev: '软件开发',
        other: '其他行业'
      },
      pageTitles: {
        wb: '工作台',
        ve: '凭证录入',
        gl: '总账',
        sl: '明细账',
        bl: '科目余额表',
        ax: '辅助明细账',
        qm: '数量金额明细账',
        ob: '期初余额',
        pay: '工资核算',
        iv: '发票管理',
        cm: '出纳管理',
        ar: '往来对账',
        tx: '税务管理',
        bg: '预算管控',
        fa: '固定资产',
        rb: '报表中心',
        ai: 'AI 智能中心',
        mc: '期末结账'
      }
    },

    dom: {
      byId(id) {
        return document.getElementById(id);
      },
      setText(id, value) {
        const el = this.byId(id);
        if (el) el.textContent = value;
      }
    },

    storage: {
      readJson(key, fallback) {
        try {
          const raw = localStorage.getItem(key);
          return raw ? JSON.parse(raw) : fallback;
        } catch (e) {
          return fallback;
        }
      },
      listAccounts() {
        const list = this.readJson('accountingAccounts', []);
        return Array.isArray(list) ? list : [];
      },
      normalizeAccount(account) {
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
      },
      saveCurrentAccount(account) {
        const normalized = this.normalizeAccount(account);
        if (!normalized) return null;
        localStorage.setItem('currentAccountId', normalized.id);
        localStorage.setItem('currentAccount', JSON.stringify(normalized));
        const list = this.listAccounts().filter(item => item && item.id !== normalized.id);
        list.unshift(normalized);
        localStorage.setItem('accountingAccounts', JSON.stringify(list));
        return normalized;
      }
    },

    account: {
      getQueryAccountId() {
        return new URLSearchParams(location.search).get('accountId') || '';
      },
      currentAccountId() {
        return this.getQueryAccountId() || localStorage.getItem('currentAccountId') || '';
      },
      getCachedAccount() {
        const queryId = this.getQueryAccountId();
        const cachedCurrent = App.storage.normalizeAccount(App.storage.readJson('currentAccount', null));
        const allAccounts = App.storage.listAccounts();

        if (queryId) {
          const hit = allAccounts.find(item => item && item.id === queryId);
          if (hit) return App.storage.saveCurrentAccount(hit);
          if (cachedCurrent && cachedCurrent.id === queryId) return cachedCurrent;
          return { id: queryId, name: '', industry: '', startDate: '' };
        }

        const savedId = localStorage.getItem('currentAccountId');
        if (savedId) {
          const hit = allAccounts.find(item => item && item.id === savedId);
          if (hit) return App.storage.saveCurrentAccount(hit);
        }

        return cachedCurrent;
      },
      applyAccount(account) {
        const normalized = App.storage.normalizeAccount(account) || this.getCachedAccount();
        if (!normalized) return;
        const name = normalized.name || '--';
        const period = String(normalized.startDate || normalized.createTime || '').slice(0, 7) || '--';
        const industry = App.config.industryMap[normalized.industry] || normalized.industry || '--';

        App.dom.setText('an', name);
        App.dom.setText('ap', period);
        App.dom.setText('ai', industry);
        App.dom.setText('wbn', name + ' · ' + period);
        App.dom.setText('ob-period', period);
        App.dom.setText('ve-period', period);
        document.title = name === '--' ? '银河星辰会计核算V2' : name + ' - 银河星辰会计核算V2';
      },
      loadMeta() {
        const cached = this.getCachedAccount();
        this.applyAccount(cached);
        const accountId = this.currentAccountId();
        if (!accountId) return Promise.resolve(cached);
        if (cached && cached.id === accountId && cached.name) return Promise.resolve(cached);

        return fetch('/api/accounts/current?id=' + encodeURIComponent(accountId))
          .then(resp => resp.json())
          .then(result => {
            if (!result || !result.success || !result.data) return cached;
            const normalized = App.storage.saveCurrentAccount(result.data);
            this.applyAccount(normalized);
            return normalized;
          })
          .catch(() => cached);
      }
    },

    ui: {
      showTab(key) {
        document.querySelectorAll('.page').forEach(el => el.classList.remove('on'));
        const page = App.dom.byId('p-' + key);
        if (page) page.classList.add('on');
        document.querySelectorAll('.nav [data-k],.tab[data-k]').forEach(el => {
          el.classList.toggle('on', el.dataset.k === key);
        });
        const title = App.config.pageTitles[key] || App.config.pageTitles.wb;
        App.dom.setText('pt', '银河星辰会计核算V2 · ' + title);
      },
      askAI(question) {
        if (window.toggleChatPanel) window.toggleChatPanel();
        const input = App.dom.byId('chatInput') || App.dom.byId('chat-input');
        if (input) {
          input.value = question;
          input.focus();
          return;
        }
        alert(question);
      },
      guide() {
        this.showTab('ve');
        const tip = App.dom.byId('gt');
        if (tip) {
          tip.textContent = 'AI步骤：整理单据→选择业务场景→生成凭证→试算平衡→审核→工资/报税/月结联动';
        }
        this.askAI('请按步骤输出本月做账流程，并包含工资核算');
      }
    },

    voucher: {
      defaultVisibleRows: 5,
      commonSummaries: [
        '销售废旧金属收入',
        '报销运输装卸费',
        '支付废旧物资采购款',
        '计提本月工资',
        '报销办公用品',
        '支付房租',
        '收到货款',
        '购买原材料'
      ],
      accountMap: {
        '1001': '库存现金',
        '1002': '银行存款',
        '1122': '应收账款',
        '2202': '应付账款',
        '6601': '销售费用',
        '6602': '管理费用',
        '6001': '主营业务收入',
        '1403': '原材料',
        '2211': '应付职工薪酬'
      },
      sceneRows: {
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
      },
      sceneNotes: {
        sale: '本月销售废旧金属收入',
        expense: '本月费用报销',
        purchase: '本月采购付款',
        salary: '本月工资计提'
      },
      escapeAttr(value) {
        return String(value == null ? '' : value).replace(/"/g, '&quot;');
      },
      parseAmount(value) {
        const text = String(value == null ? '' : value).trim();
        if (!text) return 0;
        if (/^-?\d+(\.\d+)?$/.test(text.replace(/,/g, ''))) {
          return Number(text.replace(/,/g, '')) || 0;
        }
        const negative = text.includes('-');
        const digits = text.replace(/\D/g, '');
        if (!digits) return 0;
        const normalized = digits.length === 1
          ? '0.0' + digits
          : digits.slice(0, -2) + '.' + digits.slice(-2);
        const amount = Number(normalized) || 0;
        return negative ? -amount : amount;
      },
      formatRawAmount(value) {
        return this.parseAmount(value).toFixed(2);
      },
      formatVoucherDigits(value) {
        const digits = this.formatRawAmount(value).replace('.', '');
        return digits.length > 11 ? digits.slice(-11) : digits;
      },
      getAmountValue(input) {
        if (!input) return 0;
        return this.parseAmount(input.dataset.rawValue || input.value || '0');
      },
      setAmountValue(input, value) {
        if (!input) return;
        const raw = this.formatRawAmount(value);
        input.dataset.rawValue = raw;
        input.value = document.activeElement === input ? raw : this.formatVoucherDigits(raw);
      },
      createAmountInput(value) {
        return '<input class="amount-input" inputmode="decimal" value="' + this.escapeAttr(value) + '">';
      },
      createRowHtml(row) {
        return '<tr>'
          + '<td class="seq-cell"></td>'
          + row.map((cell, index) => {
            const isAmount = index === 3 || index === 4;
            const tdClass = isAmount ? ' class="amount-cell"' : '';
            if (isAmount) {
              return '<td' + tdClass + '>' + this.createAmountInput(cell) + '</td>';
            }
            if (index === 0) {
              // 摘要输入框，添加下拉菜单
              return '<td' + tdClass + '><div class="summary-quick"><input value="' + this.escapeAttr(cell) + '" placeholder="输入摘要或按F2选择"><div class="summary-dropdown" style="position: absolute; top: 100%; left: 0; width: 100%; background-color: white; border: 1px solid #e3edf6; border-radius: 4px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); z-index: 1000; max-height: 200px; overflow-y: auto; display: none;">' + App.voucher.commonSummaries.map(summary => '<div class="summary-item" style="padding: 8px 12px; cursor: pointer; font-size: 12px;">' + summary + '</div>').join('') + '</div></div></td>';
            }
            if (index === 1) {
              // 会计科目输入框，添加自动填充功能
              return '<td' + tdClass + '><input value="' + this.escapeAttr(cell) + '" placeholder="科目编码" class="account-code-input"></td>';
            }
            return '<td' + tdClass + '><input value="' + this.escapeAttr(cell) + '"></td>';
          }).join('')
          + '<td class="op-cell">'
          + '<button class="row-op-btn" type="button" onclick="copyVoucherRow(this)">复制</button>'
          + '<button class="row-op-btn danger" type="button" onclick="deleteVoucherRow(this)">删除</button>'
          + '</td>'
          + '</tr>';
      },
      fillRows(rows) {
        const normalized = Array.isArray(rows) ? rows.map(row => row.slice()) : [];
        while (normalized.length < this.defaultVisibleRows) {
          normalized.push(['', '', '', '0.00', '0.00', '', '']);
        }
        return normalized;
      },
      refreshRowNumbers() {
        document.querySelectorAll('#vb tr').forEach((tr, index) => {
          const cell = tr.querySelector('.seq-cell');
          if (cell) cell.textContent = String(index + 1);
        });
      },
      rowInputs(rowOrButton) {
        const tr = rowOrButton instanceof HTMLElement && rowOrButton.tagName === 'TR'
          ? rowOrButton
          : rowOrButton && rowOrButton.closest
            ? rowOrButton.closest('tr')
            : null;
        return tr ? tr.querySelectorAll('input') : [];
      },
      syncAmountDisplay(input) {
        if (!input) return input;
        const raw = this.formatRawAmount(input.dataset.rawValue || input.value || '0');
        input.dataset.rawValue = raw;
        if (document.activeElement !== input) {
          input.value = this.formatVoucherDigits(raw);
        }
        return input;
      },
      syncAllAmountDisplays(scope) {
        const root = scope && scope.querySelectorAll ? scope : document;
        root.querySelectorAll('.amount-input').forEach(input => this.syncAmountDisplay(input));
        return scope;
      },
      copyRow(button) {
        const tr = button && button.closest ? button.closest('tr') : null;
        const tbody = App.dom.byId('vb');
        if (!tr || !tbody) return;
        const values = Array.from(this.rowInputs(tr)).map(input => input.value);
        tr.insertAdjacentHTML('afterend', this.createRowHtml(values));
        this.refreshRowNumbers();
        this.syncAllAmountDisplays(tbody);
        this.calculateBalance();
      },
      deleteRow(button) {
        const tbody = App.dom.byId('vb');
        const tr = button && button.closest ? button.closest('tr') : null;
        if (!tbody || !tr) return;
        const rows = tbody.querySelectorAll('tr');
        if (rows.length <= 1) {
          alert('至少保留一条分录。');
          return;
        }
        tr.remove();
        this.refreshRowNumbers();
        this.calculateBalance();
      },
      prefill(scene) {
        App.ui.showTab('ve');
        const summaryInput = App.dom.byId('vn');
        const sourceInput = App.dom.byId('vs');
        const tbody = App.dom.byId('vb');
        if (summaryInput) summaryInput.value = this.sceneNotes[scene] || this.sceneNotes.sale;
        if (sourceInput) sourceInput.value = scene === 'salary' ? '工资表/考勤表' : '销项发票/报销单/回单';
        if (tbody) {
          const targetRows = this.fillRows(this.sceneRows[scene] || this.sceneRows.sale);
          tbody.innerHTML = targetRows.map(row => this.createRowHtml(row)).join('');
        }
        this.refreshRowNumbers();
        this.syncAllAmountDisplays(tbody);
        this.recommendAccounts();
        this.calculateBalance();
      },
      addRow() {
        const tbody = App.dom.byId('vb');
        if (!tbody) return;
        const summary = App.dom.byId('vn') ? App.dom.byId('vn').value : '请输入摘要';
        const row = [summary || '请输入摘要', '', '', '0.00', '0.00', '', ''];
        tbody.insertAdjacentHTML('beforeend', this.createRowHtml(row));
        this.refreshRowNumbers();
        this.syncAllAmountDisplays(tbody);
        this.calculateBalance();
      },
      removeRow() {
        const tbody = App.dom.byId('vb');
        if (!tbody) return;
        const rows = tbody.querySelectorAll('tr');
        if (rows.length <= 1) {
          alert('至少保留一条分录。');
          return;
        }
        rows[rows.length - 1].remove();
        this.refreshRowNumbers();
        this.calculateBalance();
      },
      autoBalance() {
        const tbody = App.dom.byId('vb');
        if (!tbody) return;
        const rows = tbody.querySelectorAll('tr');
        if (!rows.length) return;
        let debit = 0;
        let credit = 0;
        rows.forEach(tr => {
          const inputs = this.rowInputs(tr);
          debit += this.getAmountValue(inputs[3]);
          credit += this.getAmountValue(inputs[4]);
        });
        const diff = Number((debit - credit).toFixed(2));
        if (Math.abs(diff) < 0.01) {
          this.calculateBalance();
          return;
        }
        const lastInputs = rows[rows.length - 1].querySelectorAll('input');
        if (diff > 0 && lastInputs[4]) {
          this.setAmountValue(lastInputs[4], this.getAmountValue(lastInputs[4]) + diff);
        } else if (diff < 0 && lastInputs[3]) {
          this.setAmountValue(lastInputs[3], this.getAmountValue(lastInputs[3]) + Math.abs(diff));
        }
        this.calculateBalance();
      },
      recommendAccounts() {
        const summaryInput = App.dom.byId('vn');
        const result = App.dom.byId('gt');
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

        const rows = document.querySelectorAll('#vb tr');
        const firstInputs = rows[0] ? this.rowInputs(rows[0]) : [];
        const secondInputs = rows[1] ? this.rowInputs(rows[1]) : [];
        if (firstInputs[1]) firstInputs[1].value = debit;
        if (secondInputs[1]) secondInputs[1].value = credit;
        if (firstInputs[3]) this.syncAmountDisplay(firstInputs[3]);
        if (secondInputs[3]) this.syncAmountDisplay(secondInputs[3]);
        if (firstInputs[4]) this.syncAmountDisplay(firstInputs[4]);
        if (secondInputs[4]) this.syncAmountDisplay(secondInputs[4]);
        if (result) result.textContent = 'AI科目推荐：借 ' + debit + '；贷 ' + credit + '。' + tip;
      },
      calculateBalance() {
        const tbody = App.dom.byId('vb');
        if (!tbody) return;
        let debit = 0;
        let credit = 0;
        tbody.querySelectorAll('tr').forEach(tr => {
          const inputs = this.rowInputs(tr);
          debit += this.getAmountValue(inputs[3]);
          credit += this.getAmountValue(inputs[4]);
        });
        const debitEl = App.dom.byId('sd');
        const creditEl = App.dom.byId('sc');
        const result = App.dom.byId('gt');
        const status = App.dom.byId('balanceStatus');
        const saveBtn = App.dom.byId('saveVoucherBtn');
        const balanced = Math.abs(debit - credit) < 0.01;
        if (debitEl) debitEl.textContent = debit.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (creditEl) creditEl.textContent = credit.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (status) {
          status.textContent = balanced ? '当前试算平衡。' : '当前借贷不平，差额 ' + Math.abs(debit - credit).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '。';
          status.classList.toggle('ok', balanced);
          status.classList.toggle('warn', !balanced);
        }
        if (saveBtn) saveBtn.disabled = !balanced;
        if (result) {
          const recommendation = result.textContent.split(' 当前试算')[0].split(' 当前借贷')[0];
          result.textContent = recommendation + (balanced ? ' 当前试算平衡。' : ' 当前借贷不平，请检查分录。');
        }
        return balanced;
      },
      renderList(list) {
        const box = App.dom.byId('voucherList');
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
      },
      loadStats() {
        const accountId = App.account.currentAccountId();
        if (!accountId) return;
        fetch('/api/accounts/' + encodeURIComponent(accountId) + '/vouchers')
          .then(resp => resp.json())
          .then(result => {
            if (!result.success || !Array.isArray(result.data)) return;
            App.dom.setText('wbVoucherCount', String(result.data.length).padStart(2, '0'));
            this.renderList(result.data);
          })
          .catch(() => {});
      },
      save() {
        const accountId = App.account.currentAccountId();
        if (!accountId) {
          alert('请先选择账套');
          return;
        }
        if (!this.calculateBalance()) {
          alert('借贷不平，不能保存凭证');
          return;
        }
        const rows = Array.from(document.querySelectorAll('#vb tr'));
        const first = rows[0] ? this.rowInputs(rows[0]) : [];
        const second = rows[1] ? this.rowInputs(rows[1]) : [];
        const payload = {
          voucherNo: App.dom.byId('voucherNo') ? App.dom.byId('voucherNo').value : '',
          voucherType: App.dom.byId('voucherType') ? App.dom.byId('voucherType').value : '记',
          date: App.dom.byId('voucherDate') ? App.dom.byId('voucherDate').value : '',
          summary: App.dom.byId('vn') ? App.dom.byId('vn').value : '',
          debitAccount: first[1] ? first[1].value : '',
          creditAccount: second[1] ? second[1].value : '',
          amount: this.getAmountValue(first[3]),
          attachments: App.dom.byId('voucherAttachments') ? App.dom.byId('voucherAttachments').value : '',
          creator: App.dom.byId('voucherCreator') ? App.dom.byId('voucherCreator').value : '',
          auditor: App.dom.byId('voucherAuditor') ? App.dom.byId('voucherAuditor').value : '',
          entries: rows.map(tr => {
            const inputs = this.rowInputs(tr);
            return {
              summary: inputs[0] ? inputs[0].value : '',
              account: inputs[1] ? inputs[1].value : '',
              debit: inputs[3] ? this.formatRawAmount(this.getAmountValue(inputs[3])) : '0.00',
              credit: inputs[4] ? this.formatRawAmount(this.getAmountValue(inputs[4])) : '0.00'
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
            this.loadStats();
          })
          .catch(error => alert('保存凭证失败：' + error.message));
      }
    },

    openingBalance: {
      collectRows() {
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
      },
      load() {
        const accountId = App.account.currentAccountId();
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
      },
      save() {
        const accountId = App.account.currentAccountId();
        if (!accountId) {
          alert('请先选择账套');
          return;
        }
        fetch('/api/accounts/' + encodeURIComponent(accountId) + '/opening-balances', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: this.collectRows() })
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
      }
    },

    bindEvents() {
      document.querySelectorAll('.nav [data-k],.tab[data-k]').forEach(el => {
        el.onclick = () => this.ui.showTab(el.dataset.k);
      });
      window.showTab = key => this.ui.showTab(key);
      window.askAI = question => this.ui.askAI(question);
      window.guide = () => this.ui.guide();
      window.prefill = scene => this.voucher.prefill(scene);
      window.rec = () => this.voucher.recommendAccounts();
      window.calc = () => this.voucher.calculateBalance();
      window.addVoucherRow = () => this.voucher.addRow();
      window.removeVoucherRow = () => this.voucher.removeRow();
      window.autoBalanceVoucher = () => this.voucher.autoBalance();
      window.copyVoucherRow = button => this.voucher.copyRow(button);
      window.deleteVoucherRow = button => this.voucher.deleteRow(button);
      window.loadVoucherList = () => this.voucher.loadStats();
      window.saveVoucher = () => this.voucher.save();
      window.saveOpeningBalance = () => this.openingBalance.save();

      document.addEventListener('focusin', event => {
        if (event.target && event.target.classList && event.target.classList.contains('amount-input')) {
          event.target.value = this.voucher.formatRawAmount(this.voucher.getAmountValue(event.target));
          requestAnimationFrame(() => {
            if (document.activeElement === event.target && event.target.select) {
              event.target.select();
            }
          });
        }
      });

      document.addEventListener('focusout', event => {
        if (event.target && event.target.classList && event.target.classList.contains('amount-input')) {
          this.voucher.syncAmountDisplay(event.target);
        }
      });

      document.addEventListener('input', event => {
        if (event.target && event.target.classList && event.target.classList.contains('amount-input')) {
          this.voucher.syncAmountDisplay(event.target);
          this.voucher.calculateBalance();
        }
      });

      // 摘要下拉菜单功能
      document.addEventListener('focus', function(e) {
        const input = e.target;
        if (input && input.parentElement && input.parentElement.classList.contains('summary-quick')) {
          const dropdown = input.nextElementSibling;
          if (dropdown && dropdown.classList.contains('summary-dropdown')) {
            dropdown.style.display = 'block';
          }
        }
      }, true);

      document.addEventListener('blur', function(e) {
        const input = e.target;
        if (input && input.parentElement && input.parentElement.classList.contains('summary-quick')) {
          setTimeout(() => {
            const dropdown = input.nextElementSibling;
            if (dropdown && dropdown.classList.contains('summary-dropdown')) {
              dropdown.style.display = 'none';
            }
          }, 200);
        }
      }, true);

      document.addEventListener('keydown', function(e) {
        const input = e.target;
        if (e.key === 'F2' && input && input.parentElement && input.parentElement.classList.contains('summary-quick')) {
          e.preventDefault();
          const dropdown = input.nextElementSibling;
          if (dropdown && dropdown.classList.contains('summary-dropdown')) {
            dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
          }
        }
      });

      // 摘要选择
      document.addEventListener('click', function(e) {
        const item = e.target;
        if (item && item.classList.contains('summary-item')) {
          const input = item.parentElement.previousElementSibling;
          if (input) {
            input.value = item.textContent;
            item.parentElement.style.display = 'none';
          }
        }
      });

      // 科目编码自动填充
      document.addEventListener('blur', function(e) {
        const input = e.target;
        if (input && input.classList.contains('account-code-input')) {
          const code = input.value.trim();
          if (code) {
            const accountName = App.voucher.accountMap[code];
            if (accountName) {
              input.value = code + ' ' + accountName;
            }
          }
        }
      });
    },

    init() {
      this.bindEvents();
      this.account.loadMeta();
      this.openingBalance.load();
      this.voucher.loadStats();
      const hash = (location.hash || '').replace(/^#/, '');
      if (hash && this.config.pageTitles[hash]) {
        this.ui.showTab(hash);
      } else if (hash === 'payroll') {
        this.ui.showTab('pay');
      } else if (hash === 'opening') {
        this.ui.showTab('ob');
      } else {
        this.ui.showTab('wb');
      }

      this.voucher.recommendAccounts();
      this.voucher.refreshRowNumbers();
      this.voucher.syncAllAmountDisplays();
      this.voucher.calculateBalance();
    }
  };

  App.init();
})();
