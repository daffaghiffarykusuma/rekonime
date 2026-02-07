import{C as c}from"./noncritical-styles.js";const r={STORAGE_KEY:"rekonime.shortcutsAcknowledged",isModalOpen:!1,appRef:null,setApp(e){this.appRef=e},getApp(){return this.appRef},getCache(){return c},shortcuts:{global:{"?":{action:"showHelp",description:"Show keyboard shortcuts",scope:"Global"},"/":{action:"focusSearch",description:"Focus search box",scope:"Global"},Escape:{action:"closeModal",description:"Close modal or dropdown",scope:"Global"},b:{action:"goToBookmarks",description:"Go to watchlist page",scope:"Global"},f:{action:"openFilters",description:"Open filter panel",scope:"Global"},s:{action:"toggleSettings",description:"Open settings",scope:"Global"},r:{action:"surpriseMe",description:"Surprise me (random anime)",scope:"Global"},h:{action:"goHome",description:"Go to home / clear filters",scope:"Global"}},modal:{ArrowLeft:{action:"previousAnime",description:"Previous anime",scope:"Detail Modal"},ArrowRight:{action:"nextAnime",description:"Next anime",scope:"Detail Modal"}}},init(){document.addEventListener("keydown",e=>this.handleKeydown(e)),this.showFirstTimeHint()},showFirstTimeHint(){if(!(typeof window>"u"))try{if(this.getCache().getRaw(this.STORAGE_KEY,{validate:!0}))return;setTimeout(()=>{const t=document.createElement("div");t.className="keyboard-hint",t.setAttribute("role","status"),t.setAttribute("aria-live","polite"),t.innerHTML=`
          <span class="keyboard-hint-text">Press <kbd>?</kbd> for keyboard shortcuts</span>
          <button class="keyboard-hint-close" aria-label="Dismiss hint">&times;</button>
        `,document.body.appendChild(t),requestAnimationFrame(()=>{t.classList.add("is-visible")});const i=setTimeout(()=>{this.dismissHint(t)},8e3);t.querySelector(".keyboard-hint-close").addEventListener("click",()=>{clearTimeout(i),this.dismissHint(t)});const o=()=>{this.getCache().setRaw(this.STORAGE_KEY,"true",{validate:!0}),document.removeEventListener("keydown",o),document.removeEventListener("click",o)};document.addEventListener("keydown",o,{once:!0}),document.addEventListener("click",o,{once:!0})},2e3)}catch{}},dismissHint(e){e.classList.remove("is-visible"),setTimeout(()=>{e.remove()},300)},handleKeydown(e){const s=e.target.matches("input, textarea, select");if(s&&e.key!=="Escape"||this.isModalOpen&&e.key!=="Escape"&&e.key!=="?")return;const t=document.getElementById("detail-modal")?.classList.contains("visible");let i=null;t&&this.shortcuts.modal[e.key]?i=this.shortcuts.modal[e.key]:this.shortcuts.global[e.key]&&(i=this.shortcuts.global[e.key]),i&&((!s||e.key==="Escape")&&e.preventDefault(),this.executeAction(i.action))},executeAction(e){switch(e){case"showHelp":this.showShortcutsModal();break;case"focusSearch":this.focusSearch();break;case"closeModal":this.closeModal();break;case"goToBookmarks":this.goToBookmarks();break;case"openFilters":this.openFilters();break;case"toggleSettings":this.toggleSettings();break;case"surpriseMe":this.surpriseMe();break;case"goHome":this.goHome();break;case"previousAnime":this.navigateAnime(-1);break;case"nextAnime":this.navigateAnime(1);break}},showShortcutsModal(){if(this.isModalOpen){this.closeShortcutsModal();return}this.isModalOpen=!0;try{this.getCache().setRaw(this.STORAGE_KEY,"true",{validate:!0})}catch{}document.querySelector(".keyboard-hint")?.remove();const e=Object.entries(this.shortcuts.global).map(([o,a])=>this.renderShortcutRow(o,a)).join(""),s=Object.entries(this.shortcuts.modal).map(([o,a])=>this.renderShortcutRow(o,a)).join(""),t=document.createElement("div");t.className="modal-overlay shortcuts-modal-overlay",t.id="shortcuts-modal",t.setAttribute("role","dialog"),t.setAttribute("aria-modal","true"),t.setAttribute("aria-labelledby","shortcuts-modal-title"),t.innerHTML=`
      <div class="modal-content shortcuts-modal-content">
        <button class="modal-close" id="close-shortcuts" type="button" aria-label="Close keyboard shortcuts">
          &times;
        </button>
        <div class="shortcuts-modal-body">
          <h2 class="shortcuts-modal-title" id="shortcuts-modal-title">
            <span class="shortcuts-icon" aria-hidden="true">⌨️</span>
            Keyboard Shortcuts
          </h2>
          
          <div class="shortcuts-section">
            <h3 class="shortcuts-section-title">Global Shortcuts</h3>
            <div class="shortcuts-list">
              ${e}
            </div>
          </div>

          <div class="shortcuts-section">
            <h3 class="shortcuts-section-title">When Viewing Anime Details</h3>
            <div class="shortcuts-list">
              ${s}
            </div>
          </div>

          <div class="shortcuts-tip">
            <span class="shortcuts-tip-icon" aria-hidden="true">💡</span>
            <span>Tip: These shortcuts work anywhere on the site, except when typing in search or filter fields.</span>
          </div>
        </div>
      </div>
    `,document.body.appendChild(t),document.body.classList.add("is-scroll-locked"),requestAnimationFrame(()=>{t.classList.add("visible"),t.querySelector(".modal-close").focus()}),t.querySelector("#close-shortcuts").addEventListener("click",()=>this.closeShortcutsModal()),t.addEventListener("click",o=>{o.target===t&&this.closeShortcutsModal()}),this.setupFocusTrap(t)},renderShortcutRow(e,s){return`
      <div class="shortcut-row">
        <kbd class="shortcut-key">${e===" "?"Space":e}</kbd>
        <span class="shortcut-description">${this.escapeHtml(s.description)}</span>
      </div>
    `},closeShortcutsModal(){const e=document.getElementById("shortcuts-modal");e&&(e.classList.remove("visible"),setTimeout(()=>{e.remove(),this.isModalOpen=!1,document.querySelector(".modal-overlay.visible")||document.body.classList.remove("is-scroll-locked")},300))},setupFocusTrap(e){const s=e.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),t=s[0],i=s[s.length-1];e.addEventListener("keydown",o=>{o.key==="Tab"&&(o.shiftKey&&document.activeElement===t?(o.preventDefault(),i.focus()):!o.shiftKey&&document.activeElement===i&&(o.preventDefault(),t.focus()))})},focusSearch(){const e=document.getElementById("header-search");e&&(e.focus(),e.select())},closeModal(){if(this.isModalOpen){this.closeShortcutsModal();return}const e=this.getApp();if(e&&typeof e.handleGlobalEscape=="function"){const s={key:"Escape"};e.handleGlobalEscape(s)}},goToBookmarks(){window.location.href="watchlist.html"},openFilters(){const e=this.getApp();e&&typeof e.toggleFilterPanel=="function"&&e.toggleFilterPanel()},toggleSettings(){const e=this.getApp();e&&typeof e.toggleSettingsModal=="function"&&e.toggleSettingsModal()},surpriseMe(){const e=document.getElementById("surprise-toggle");e&&e.click()},goHome(){const e=this.getApp();e&&typeof e.clearAllFilters=="function"&&e.clearAllFilters(),window.scrollTo({top:0,behavior:"smooth"})},navigateAnime(e){const s=this.getApp();if(!s||!s.currentAnimeId||!s.animeData)return;const t=s.animeData.findIndex(o=>o.id===s.currentAnimeId);if(t===-1)return;const i=t+e;if(i>=0&&i<s.animeData.length){const o=s.animeData[i];s.showAnimeDetail(o.id)}},escapeHtml(e){const s=document.createElement("div");return s.textContent=e,s.innerHTML}};export{r as KeyboardShortcuts,r as default};
