document.addEventListener('DOMContentLoaded', function () {
  var script = `
      scripts = [
        '//cdnjs.cloudflare.com/ajax/libs/highlight.js/9.9.0/highlight.min.js'
      ]

      const scriptsReady = Promise.all(scripts.map((src, index) => {
        return new Promise(resolve => {
          const element  = document.createElement('script')
          element.src = src
          element.onload = () => resolve()
          document.getElementsByTagName('head')[0].appendChild(element)
        })
      }))


      styles = [
        '//cdn.jsdelivr.net/highlight.js/9.9.0/styles/agate.min.css'
      ]

      const stylesReady = Promise.all(styles.map((src, index) => {
        return new Promise(resolve => {
          const element = document.createElement('link')
          element.rel = 'stylesheet'
          element.href = src
          element.onload = () => resolve()
          document.getElementsByTagName('head')[0].appendChild(element)
        })
      }))

      render = () => {
        if (!document.querySelector('#msgs_div').ondblclick) {
          document.querySelector('#msgs_div').ondblclick = event => {
            const message = event.path.find(element => element.nodeName === 'TS-MESSAGE')
            if (!message) return
            message.querySelector('a[data-action="actions_menu"]').click()
            document.querySelector('#edit_link').click()
          }
        }

        Array.from(document.querySelectorAll('.message'))
          .filter(element => !element.id.includes('xxx'))
          .forEach(element => {
            Array.from(element.querySelectorAll('pre.special_formatting:not(.hljs)'))
              .forEach(element => {
                const text = element.innerText
                const [firstLine = false] = text.split('\\n') || []
                if (firstLine && !firstLine.includes(' ') && hljs.getLanguage(firstLine)) {
                  const newContent = text.replace(firstLine + '\\n', '')
                  element.innerText = newContent
                  element.classList.add(firstLine)
                }
                hljs.highlightBlock(element)
              })
          })
      }

      Promise.all([scriptsReady, stylesReady]).then(() => {
        render()
        setInterval(() => {
          render()
        }, 1000)
      })

    `

  setInterval(() => {
    Array.from(document.querySelectorAll('webview'))
      .filter(webview => !webview.getAttribute('data-loaded'))
      .forEach(webview => {
        webview.setAttribute('data-loaded', true)
        webview.addEventListener('dom-ready', () => {
          webview.executeJavaScript(script)
        })
      })
  }, 1000)
})
