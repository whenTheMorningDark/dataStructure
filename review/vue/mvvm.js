class Vue {
  constructor(options) {
    this.$el = options.el;
    this.$data = options.data;
    let computed = options.computed;
    let methods = options.methods;
    if (this.$el) {
      // 把数据转换成Object.defineProperty定义
      new Observer(this.$data);
      for (let key in computed) {
        Object.defineProperty(this.$data, key, {
          get: () => {
            return computed[key].call(this)
          }
        })
      }
      for (let key in methods) {
        Object.defineProperty(this, key, {
          get() {
            return methods[key]
          }
        })
      }
      this.proxyVm(this.$data);
      new Compiler(this.$el, this)
    }
  }
  proxyVm(data) {
    for (let key in data) {
      Object.defineProperty(this, key, {
        get() {
          return data[key]
        }
      })
    }
  }
}

class Dep {
  constructor() {
    this.subs = [] // 存放所有的watcher
  }
  // 订阅
  addSub(watcher) {
    this.subs.push(watcher)
  }
  // 发布
  notify() {
    this.subs.forEach(watcher => watcher.update())
  }
}

// 观察者

class Watcher {
  constructor(vm, expr, cb) {
    this.vm = vm;
    this.expr = expr;
    this.cb = cb;
    // 默认放一个老值
    this.oldValue = this.get()
  }
  get() {
    Dep.target = this;
    let value = ComileUtils.getVal(this.vm, this.expr)
    Dep.target = null;
    return value
  }
  update() { // 更新操作
    let newVal = ComileUtils.getVal(this.vm, this.expr);
    if (newVal !== this.oldValue) {
      this.cb(newVal)
    }
  }
}

class Observer { //数据劫持
  constructor(data) {
    // console.log(data);
    this.observer(data);
  }
  observer(data) {
    if (data && typeof data == "object") {
      for (let key in data) {
        this.defaineReactive(data, key, data[key])
      }
    }
  }
  defaineReactive(obj, key, value) {
    this.observer(value)
    let dep = new Dep()
    Object.defineProperty(obj, key, {
      get() {
        Dep.target && dep.addSub(Dep.target)
        return value
      },
      set: (newVal) => {
        if (newVal !== value) {
          this.observer(newVal)
          value = newVal
          dep.notify()
        }
      }
    })
  }
}


class Compiler {
  constructor(el, vm) {
    this.vm = vm;
    this.el = this.isElementNode(el) ? el : document.querySelector(el);
    // console.log(this.el)
    // 把当前节点放到内存中
    let fragment = this.node2fragment(this.el);
    // console.log(fragment)
    this.compile(fragment)
    this.el.appendChild(fragment)
  }
  isDirective(attrName) {
    return attrName.startsWith("v-")
  }
  // 编译元素
  compileElement(node) {
    let attributes = node.attributes;
    [...attributes].forEach(v => {
      // console.log(attr)
      let {
        name,
        value: expr
      } = v;
      if (this.isDirective(name)) {
        let [, directive] = name.split("-");
        let [directiveName, eventName] = directive.split(":");
        console.log(node);
        ComileUtils[directiveName](node, expr, this.vm, eventName)
      }
    })
  }
  compileText(node) { // 判断挡墙文本节点中的内容是否包含{{}}
    let content = node.textContent;
    // console.log(content);
    if (/\{\{(.+?)\}\}/.test(content)) {
      // console.log(content); // 找到所有文本
      ComileUtils["text"](node, content, this.vm)
    }
  }
  compile(node) { // 编译内存的dom节点
    let childNodes = node.childNodes;
    // console.log(childNodes);
    [...childNodes].forEach(child => {
      if (this.isElementNode(child)) {
        // console.log("ele", child)
        this.compileElement(child)
        //如果是元素
        this.compile(child)
      } else {
        // console.log("elea", child)
        this.compileText(child)
      }
    })
  }
  node2fragment(node) {
    let fragment = document.createDocumentFragment();
    let firstChild;
    while (firstChild = node.firstChild) {
      fragment.append(firstChild)
    }
    return fragment;
  }
  isElementNode(node) {
    return node.nodeType === 1;
  }
}
ComileUtils = {
  getVal(vm, expr) {
    return expr.split(".").reduce((data, current) => {
      return data[current]
    }, vm.$data)
  },
  setValue(vm, expr, value) {
    expr.split(".").reduce((data, current, index, arr) => {
      if (arr.length - 1 === index) {
        data[current] = value;
      }
      return data[current]
    }, vm.$data)
  },
  model(node, expr, vm) { // node节点 expr表达式 vm当前实例
    let fn = this.updater["modelUpdater"];
    new Watcher(vm, expr, (newVal) => {
      fn(node, newVal)
    });
    node.addEventListener("input", (e) => {
      let value = e.target.value;
      this.setValue(vm, expr, value);
    })
    let value = this.getVal(vm, expr);
    fn(node, value)
  },
  getContentVal(vm, expr) {
    return expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
      return this.getVal(vm, args[1])
    })
  },
  on(node, expr, vm, eventName) {
    node.addEventListener(eventName, (e) => {
      vm[expr].call(vm, e);
    })
  },
  text(node, expr, vm) {
    let fn = this.updater["textUpdater"]
    let content = expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
      new Watcher(vm, args[1], (newVal) => {
        fn(node, this.getContentVal(vm, expr))
      })
      return this.getVal(vm, args[1])
    })
    fn(node, content)
  },
  html(node, expr, vm) {
    let fn = this.updater["htmlUpdater"]
    let content = expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
      new Watcher(vm, expr, (newVal) => {
        fn(node, newVal)
      })
      return this.getVal(vm, expr)
    })
    fn(node, content)
  },
  updater: {
    modelUpdater(node, value) {
      node.value = value;
    },
    textUpdater(node, value) {
      node.textContent = value;
    },
    htmlUpdater(node, value) {
      node.innerHTML = value
    }
  }
}