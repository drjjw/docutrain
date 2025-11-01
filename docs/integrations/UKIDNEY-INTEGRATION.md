# UKidney.com Integration Guide

Complete guide for embedding the Manual Assistant on brightbean.io.

---

## 🎯 **Option 1: UIkit Modal (Recommended)**

### **Step 1: Add the Trigger Button**

Place this wherever you want the "Open Manual" button on your page:

```html
<button class="uk-button uk-button-primary" uk-toggle="target: #manual-assistant-modal">
    📚 Open Manual Assistant
</button>
```

### **Step 2: Add the Modal Structure**

Add this at the bottom of your page template (before `</body>`):

```html
<!-- Manual Assistant Modal -->
<div id="manual-assistant-modal" uk-modal>
    <div class="uk-modal-dialog uk-modal-body" style="width: 95vw; height: 95vh; max-width: 95vw; max-height: 95vh; padding: 0;">
        <button class="uk-modal-close-default" type="button" uk-close></button>
        <iframe 
            src="https://your-chatbot-server.com"
            style="width: 100%; height: 100%; border: none;"
            title="UKidney Manual Assistant"
            allow="clipboard-write">
        </iframe>
    </div>
</div>
```

### **Step 3: Update Your Server URL**

Replace `https://your-chatbot-server.com` with your actual chatbot URL once deployed.

---

## 🎯 **Option 2: jQuery Full-Screen Modal**

### **Step 1: Add CSS (in `<head>` or your stylesheet)**

```html
<style>
/* Manual Assistant Modal */
.manual-modal-overlay {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    z-index: 9998;
}

.manual-modal-container {
    display: none;
    position: fixed;
    top: 2.5vh;
    left: 2.5vw;
    width: 95vw;
    height: 95vh;
    background: white;
    border-radius: 8px;
    z-index: 9999;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

.manual-modal-close {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 40px;
    height: 40px;
    background: white;
    border: 2px solid #e0e0e0;
    border-radius: 50%;
    cursor: pointer;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    color: #666;
}

.manual-modal-close:hover {
    background: #c45555;
    color: white;
    border-color: #c45555;
}

.manual-modal-container iframe {
    width: 100%;
    height: 100%;
    border: none;
    border-radius: 8px;
}
</style>
```

### **Step 2: Add HTML (anywhere in your page)**

```html
<!-- Trigger Button -->
<button class="manual-assistant-trigger" id="openManualAssistant">
    📚 Open Manual Assistant
</button>

<!-- Modal Structure -->
<div class="manual-modal-overlay" id="manualModalOverlay"></div>
<div class="manual-modal-container" id="manualModalContainer">
    <button class="manual-modal-close" id="closeManualModal">&times;</button>
    <iframe 
        src="https://your-chatbot-server.com"
        title="UKidney Manual Assistant"
        allow="clipboard-write">
    </iframe>
</div>
```

### **Step 3: Add JavaScript (before `</body>`)**

```html
<script>
$(document).ready(function() {
    // Open modal
    $('#openManualAssistant').on('click', function() {
        $('#manualModalOverlay').fadeIn(300);
        $('#manualModalContainer').fadeIn(300);
        $('body').css('overflow', 'hidden');
    });
    
    // Close modal
    function closeModal() {
        $('#manualModalOverlay').fadeOut(300);
        $('#manualModalContainer').fadeOut(300);
        $('body').css('overflow', '');
    }
    
    $('#closeManualModal, #manualModalOverlay').on('click', closeModal);
    
    // ESC key to close
    $(document).on('keydown', function(e) {
        if (e.key === 'Escape') closeModal();
    });
});
</script>
```

---

## 🎯 **Option 3: Vanilla JavaScript (No jQuery)**

If you want to avoid jQuery dependency:

```html
<script>
document.addEventListener('DOMContentLoaded', function() {
    const openBtn = document.getElementById('openManualAssistant');
    const overlay = document.getElementById('manualModalOverlay');
    const container = document.getElementById('manualModalContainer');
    const closeBtn = document.getElementById('closeManualModal');
    
    function openModal() {
        overlay.style.display = 'block';
        container.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
    
    function closeModal() {
        overlay.style.display = 'none';
        container.style.display = 'none';
        document.body.style.overflow = '';
    }
    
    openBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeModal();
    });
});
</script>
```

---

## 🎨 **Customization Options**

### **Button Variations:**

**Primary Button (Red):**
```html
<button class="uk-button uk-button-primary" uk-toggle="target: #manual-assistant-modal">
    📚 Manual Assistant
</button>
```

**Secondary Button (Grey):**
```html
<button class="uk-button uk-button-default" uk-toggle="target: #manual-assistant-modal">
    📚 Manual Assistant
</button>
```

**Link Style:**
```html
<a href="#" class="uk-link-heading" uk-toggle="target: #manual-assistant-modal">
    Manual Assistant
</a>
```

**Icon Only:**
```html
<button class="uk-button uk-button-primary" uk-toggle="target: #manual-assistant-modal">
    <span uk-icon="book"></span>
</button>
```

### **Modal Size Options:**

**Full Screen (95% - Recommended):**
```css
width: 95vw; height: 95vh;
```

**Large (80%):**
```css
width: 80vw; height: 80vh;
```

**Medium (70%):**
```css
width: 70vw; height: 70vh;
```

**True Full Screen (100%):**
```css
width: 100vw; height: 100vh; border-radius: 0;
```

---

## 📱 **Responsive Considerations**

Add this CSS for mobile optimization:

```css
@media (max-width: 768px) {
    .manual-modal-container {
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        border-radius: 0;
    }
}
```

---

## 🔧 **Advanced: Multiple Trigger Buttons**

You can add multiple trigger buttons across your site:

```html
<!-- In navigation -->
<a href="#" uk-toggle="target: #manual-assistant-modal">Manual Search</a>

<!-- In sidebar -->
<button uk-toggle="target: #manual-assistant-modal">Ask AI</button>

<!-- In footer -->
<button uk-toggle="target: #manual-assistant-modal">Manual Assistant</button>
```

All will open the same modal!

---

## 🎯 **Complete Ready-to-Paste Code**

### **For UIkit Sites:**

```html
<!-- Add anywhere in your page -->
<button class="uk-button uk-button-primary" uk-toggle="target: #manual-assistant-modal">
    📚 Open Manual Assistant
</button>

<!-- Add before </body> -->
<div id="manual-assistant-modal" uk-modal>
    <div class="uk-modal-dialog uk-modal-body" style="width: 95vw; height: 95vh; max-width: 95vw; max-height: 95vh; padding: 0;">
        <button class="uk-modal-close-default" type="button" uk-close></button>
        <iframe 
            src="https://your-chatbot-server.com"
            style="width: 100%; height: 100%; border: none;"
            title="UKidney Manual Assistant">
        </iframe>
    </div>
</div>
```

### **For jQuery Sites:**

```html
<!-- Add in <head> or stylesheet -->
<style>
.manual-modal-overlay {
    display: none; position: fixed; top: 0; left: 0;
    width: 100%; height: 100%; background: rgba(0,0,0,0.7);
    z-index: 9998;
}
.manual-modal-container {
    display: none; position: fixed; top: 2.5vh; left: 2.5vw;
    width: 95vw; height: 95vh; background: white;
    border-radius: 8px; z-index: 9999;
    box-shadow: 0 20px 60px rgba(0,0,0,0.4);
}
.manual-modal-close {
    position: absolute; top: 10px; right: 10px;
    width: 40px; height: 40px; background: white;
    border: 2px solid #e0e0e0; border-radius: 50%;
    cursor: pointer; z-index: 10000;
    font-size: 24px; color: #666; text-align: center;
    line-height: 36px;
}
.manual-modal-close:hover {
    background: #c45555; color: white; border-color: #c45555;
}
.manual-modal-container iframe {
    width: 100%; height: 100%; border: none; border-radius: 8px;
}
</style>

<!-- Add in your page -->
<button id="openManualAssistant" style="background: #c45555; color: white; padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer;">
    📚 Open Manual Assistant
</button>

<!-- Add before </body> -->
<div class="manual-modal-overlay" id="manualModalOverlay"></div>
<div class="manual-modal-container" id="manualModalContainer">
    <button class="manual-modal-close" id="closeManualModal">&times;</button>
    <iframe src="https://brightbean.io/content/manuals/bot/"></iframe>
</div>

<script>
$(function() {
    $('#openManualAssistant').click(function() {
        $('#manualModalOverlay, #manualModalContainer').fadeIn(300);
        $('body').css('overflow', 'hidden');
    });
    
    $('#closeManualModal, #manualModalOverlay').click(function() {
        $('#manualModalOverlay, #manualModalContainer').fadeOut(300);
        $('body').css('overflow', '');
    });
    
    $(document).keydown(function(e) {
        if (e.key === 'Escape') {
            $('#manualModalOverlay, #manualModalContainer').fadeOut(300);
            $('body').css('overflow', '');
        }
    });
});
</script>
```

---

## 🚀 **Quick Start Checklist:**

- [ ] Choose UIkit or jQuery version
- [ ] Copy the CSS to your stylesheet
- [ ] Add the trigger button where you want it
- [ ] Add the modal HTML before `</body>`
- [ ] Copy the JavaScript
- [ ] Update iframe `src` to your chatbot URL
- [ ] Test on brightbean.io

---

## 📊 **Features:**

- ✅ **95% viewport** - Maximum usable space
- ✅ **ESC to close** - Keyboard shortcut
- ✅ **Click outside to close** - Overlay dismissal
- ✅ **Smooth animations** - Fade in/out
- ✅ **Body scroll lock** - Prevents background scrolling
- ✅ **Mobile responsive** - Adapts to screen size

---

## 💡 **Pro Tips:**

1. **Lazy loading**: The iframe only loads when modal opens (already configured)
2. **Multiple triggers**: Use same `uk-toggle` or jQuery selector
3. **Preload**: Add `loading="eager"` if you want instant loading
4. **Custom button**: Style to match your existing brightbean.io buttons

---

## 🎨 **Color Variables (for easy theming):**

```css
:root {
    --ukidney-primary: #d32f2f;
    --ukidney-primary-hover: #c62828;
}

.manual-assistant-trigger {
    background: var(--ukidney-primary);
}

.manual-assistant-trigger:hover {
    background: var(--ukidney-primary-hover);
}
```

---

## 📦 **Files Created:**

1. **`embed-uikit-modal.html`** - Working UIkit example
2. **`embed-jquery-modal.html`** - Working jQuery example
3. **This guide** - Complete integration instructions

Open either example file in your browser to see it working!

---

## ⚙️ **Next Steps:**

1. Test the examples locally
2. Choose your preferred method (UIkit or jQuery)
3. Copy the code to brightbean.io
4. Deploy your chatbot to a server
5. Update the iframe `src` URL

Your full-screen chatbot modal is ready! 🎉

