/**
 * Lightweight SplitText utility to replicate GSAP's SplitText behavior.
 * Divides text into word and character spans for granular animations.
 * 
 * @param {string|HTMLElement} elementOrSelector - Target element(s) to split
 * @param {Object} options - Split options
 * @param {string} options.type - How to split ('words', 'chars', or 'words,chars')
 * @returns {Object|Object[]} Object containing the split words/chars arrays, or array of objects if multiple elements
 */
export function splitText(elementOrSelector, options = { type: 'words,chars' }) {
  const elements = typeof elementOrSelector === 'string' 
    ? document.querySelectorAll(elementOrSelector) 
    : (elementOrSelector instanceof HTMLElement ? [elementOrSelector] : Array.from(elementOrSelector));

  const results = [];

  elements.forEach(el => {
    // Collect child nodes to process them
    const childNodes = Array.from(el.childNodes);
    el.innerHTML = ''; // Clear original content

    const typeWords = options.type.includes('words');
    const typeChars = options.type.includes('chars');

    const wordSpans = [];
    const charSpans = [];

    childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        // Split text by spaces, preserving the spaces as capture groups
        const tokens = text.split(/(\s+)/);
        
        tokens.forEach(token => {
          if (!token) return;
          
          if (/^\s+$/.test(token)) {
            // It's whitespace, append as a space span
            const space = document.createElement('span');
            space.className = 'split-space';
            space.style.display = 'inline-block';
            space.innerHTML = '&nbsp;';
            el.appendChild(space);
          } else {
            // It's a word
            const wordSpan = document.createElement('span');
            wordSpan.className = 'split-word';
            wordSpan.style.display = 'inline-block';
            wordSpan.style.position = 'relative';
            wordSpan.style.whiteSpace = 'nowrap';

            if (typeChars) {
              const chars = token.split('');
              chars.forEach(charText => {
                const charSpan = document.createElement('span');
                charSpan.className = 'split-char';
                charSpan.style.display = 'inline-block';
                charSpan.style.position = 'relative';
                charSpan.textContent = charText;
                wordSpan.appendChild(charSpan);
                charSpans.push(charSpan);
              });
            } else {
              wordSpan.textContent = token;
            }

            el.appendChild(wordSpan);
            wordSpans.push(wordSpan);
          }
        });
      } else if (node.nodeName === 'BR') {
        // Preserve BR tags
        const br = document.createElement('br');
        el.appendChild(br);
      } else {
        // Clone other elements
        el.appendChild(node.cloneNode(true));
      }
    });

    results.push({
      element: el,
      words: wordSpans,
      chars: charSpans
    });
  });

  return results.length === 1 ? results[0] : results;
}
