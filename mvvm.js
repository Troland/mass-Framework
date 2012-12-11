define("mvvm","$event,$css,$attr".split(","), function($){
    var source = {} //http://rivetsjs.com/#rivets
    BINDING = $.config.bindname || "data",
    $.applyBindings = function(  model, node ){
        node = node || document.body;
        model = $.ViewModel( model );

        setBindingsToElements (node, model)
        return model
    }
    function setBindingsToElements (node, model){
        if ( node.nodeType === 1  ){
            var continueBindings = true;
            var bindings = getBindings( node )
            if( bindings.length ){
                continueBindings = setBindingsToElement(node, model, bindings );
            }
            if( continueBindings ){
                var elems = getChildren( node );
                elems.length && setBindingsToChildren(elems, model)
            }
        }
    }
    //在写框架时，最担心的事是——这些api设计得合理吗？使用者们能以多低的成本理解我的设计意图？
    //我的设计是在帮助他们，还是在限制他们？在保持功能不变的情况下，学习成本还能进一步降低吗？
    //对于写框架，我有种敬畏心理，感激愿意使用你框架的人，要为易用性、灵活性和健壮性负责，这是很大的挑战。
    function setBindingsToElement( node, model, bindings ){
        var continueBindings = true;
        for(var i = 0, bind; bind = bindings[i++];){
            //取得MVVM的绑定器与用户参数,如data-on-click,绑定处理器为$.ViewBindings.on, 参数为"click"
            var args = parseBinding(bind[0]);
            if(!args){
                continue
            }
            var  match = bind[1].split(/\s*:\s*/),
            accessor = model,
            names = match[0],
            callback = match[1];
            names = names.split(".");
            for(var k = 0, name; name = names[k++];){
                if( name in accessor){//accessor[name]可能为零
                    accessor = accessor[name];
                }
            }
            if(accessor === void 0){//accessor可能为零
                continue
            }
            var binding = args.shift();
            //如果该绑定指明不能往下绑,比如html, text会请空原节点的内部
            //或者是foreach绑定,但它又没有子元素作为它的动态模板就中止往下绑
            if(binding.stopBindings || binding == $.ViewBindings.each && Array.isArray(accessor) && !accessor.length ){
                continueBindings = false;
            }
            //将VM中的访问器与元素节点绑定在一起,具体做法是将数据隐藏抽象成第三种访问器----DOM访问器
            //DOM访问器通过绑定器操作属性访问器与组合访问器的值渲染页面,
            //而VM通过属性访问器与组合访问器驱动DOM访问器操作DOM
            convertToDomAccessor(node, binding, accessor, model, callback, args);
        }
        return continueBindings;
    }
    //参数分别为model, pnames, pvalues
    function setBindingsToChildren( elems, model ){
        for(var i = 0, el; el = elems[i++];){
            setBindingsToElements(el, model );
        }
    }
    //取得元素的所有子元素节点
    function getChildren( node ){
        var elems = [] ,ri = 0;
        for (node = node.firstChild; node; node = node.nextSibling){
            if (node.nodeType === 1){
                elems[ri++] = node;
            }
        }
        return elems;
    }

    //DOM访问器，直接与DOM树中的节点打交道的访问器，是实现双向绑定的关键。
    //它们仅在用户调用了$.View(viewmodel, node )方法，才根据用户写在元素节点上的bind属性生成出来。
    //names values 包含上一级的键名与值
    function convertToDomAccessor (node, binding, visitor, model, callback, args ){
        function accessor( neo ){
            if( !accessor.$uuid ){ //只有在第一次执行它时才进入此分支
                if( binding == $.ViewBindings.each ){
                    var p = visitor["$"+expando] || ( visitor[ "$"+ expando] =  [] );
                    $.Array.ensure( p ,accessor);
                    arguments = ["start"];
                }
                bridge[ expando ] = accessor;
            }
            var val;
            String(visitor);//强制获取依赖
            if(typeof visitor == "function"){
                val = visitor()
            }else{
                val = visitor
            }
            if( !accessor.$uuid ){
                delete bridge[ expando ];
                accessor.$uuid = ++uuid;
                //第四个参数供流程绑定使用
                binding.init && binding.init(node, val, visitor, accessor, callback, args);
            }
            var method = arguments[0], more = arguments[1]
            if( typeof binding[method] == "function" ){
                //处理foreach.start, sort, reserve, unshift, shift, pop, push....
                var ret = binding[method]( accessor, val, accessor.fragments, method, more );
                if( ret ){
                    val = ret;
                }
            }
            //只有执行到这里才知道要不要中断往下渲染
            accessor.$val = val
            binding.update(node, val, accessor, model, callback, args);
            return val  //val;
        }
        return completeAccessor( "interacted" ,accessor, node);
    }
    function parseBinding( str ){
        var array = str.slice(BINDING.length + 1).split("-") ;
        var binding = $.ViewBindings[ array[0] ];
        if( binding){
            array[0] = binding;
            return array;
        }else{
            return false;
        }
    }
    //执行绑定在元素标签内的各种指令
    //MVVM不代表什么很炫的视觉效果之类的，它只是组织你代码的一种方式。有方便后期维护，松耦合等等优点而已
    var inputOne = $.oneObject("text,password,textarea,tel,url,search,number,month,email,datetime,week,datetime-local")
    $.ViewBindings  = {
        text: {
            update:  function( node, val ){
                val = val == null ? "" : val+""
                if(node.childNodes.length === 1 && node.firstChild.nodeType == 3){
                    node.firstChild.data = val;
                }else{
                    $( node ).text( val );
                }
            }
        },
        "class": {//相当于toggleClass
            update:  function( node, val ){
                var $node = $(node), type = typeof val
                if(val && type == "object"){
                    for(var cls in val){
                        if(val[cls]){
                            $node.addClass(cls)
                        }else{
                            $node.removeClass(cls)
                        }
                    }
                }else {
                    $node.toggleClass( arguments[5][0] || val )
                }
            }
        },
        attr: {
            update: function( node, val ){
                var  type = typeof val
                if(val && type == "object"){
                    for (var name in val) {
                        $.attr(node, name, val[ name ] );
                    }
                }else{
                    $.attr(node, arguments[5][0], val );
                }
            }
        },
        display: {
            update: function( node, val ){
                $(node).toggle( !!val )
            }
        },
        enable: {
            update: function( node, val ){
                if (val && node.disabled)
                    node.removeAttribute("disabled");
                else if ((!val) && (!node.disabled))
                    node.disabled = true;
            }
        },
        hasfocus: {
            update: function( node, val ){

            }
        },
        options:{
            update: function( node, val ){
                var display = node.style.display;
                //http://lives.iteye.com/blog/966217
                val.forEach(function(el){
                    var option;
                    if(typeof el == "function"){
                        option = new Option(el(), el());
                    }else if(typeof el == "object"){
                        var text = el.text()
                        option = new Option( text, el.value ? el.value() : text );
                        for(var i in el){
                            if(el.hasOwnProperty(i) && i !== "text" && i !== "value"){
                                option[i] = typeof i =="function" ? el[i]() : el[i]
                            }
                        }
                    }
                    //这里要注意的add()函数的第二个参数，该参数为before，可以指定选项插到哪个选项之前，
                    //如果为null则插到最后。如果不指定这个参数在IE系不会有问题，FF下会报错，
                    //提示Not enough arguments,参数不足，所以最好传个null先。
                    option && node.add(option, null);
                });
                node.style.display = display
            }

        },
        html: {
            update: function( node, val ){
                $( node ).html( val );
            },
            stopBindings: true
        },
        value:{
            init: function(node, val, accessor){
                if(/input|textarea/i.test(node.nodeName) && inputOne[node.type]){
                    $(node).on("input",function(){
                        accessor(node.value);
                    });
                }
            },
            update: function( node, val ){
                node.value = val;
            }
        },
        template: {
            //它暂时只供内部使用
            update: function( node, val, accessor, model, code, args){
                //code对应 1 if,  0  unless,2  with -1 each
                var fragment = accessor.fragments[0];      //取得原始模板
                if( code > 0 ){                            //处理with if 绑定
                    fragment.recover();                    //将它所引用着的节点移出DOM树
                    var elems = getChildren( fragment );   //取得它们当中的元素节点
                    node.appendChild( fragment );          //再放回DOM树

                    if( elems.length ){
                        if( code == 2 ){                    //处理with 绑定
                            var fn = function(){}
                            fn.prototype = model;
                            model = new fn;
                            for(var name in val){
                                if(val.hasOwnProperty(name)){
                                    model[name] = val[name]
                                }
                            }
                        }
                        return setBindingsToChildren( elems, model )
                    }
                }else if( code === 0 ){                    //处理unless 绑定
                    fragment.recover();
                }
                if( code < 0  && val ){                    //处理each 绑定
                    var fragments = accessor.fragments;
                    if(!val.length){                    //如果对应集合为空,那么视图中的节点要移出DOM树
                        fragments[0].recover();
                        return
                    }
                    for( var i = 0, el ; el = fragments[i]; i++){
                        el.recover();                      //先回收，以防在unshift时，新添加的节点就插入在后面
                        elems = getChildren( el );
                        node.appendChild( el );            //继续往元素的子节点绑定数据
                        (function(a, b){
                            if(args.length){
                                var fn = function(){}
                                fn.prototype = model;
                                var m = new fn;
                                if(args[0]){
                                    m[args[0]] = a;//item
                                }
                                if(args[1]){
                                    m[args[1]] = val.$isObj ? a.$key : b;//index
                                }
                            }else{
                                m = model;
                            }
                            setBindingsToChildren( elems, m );
                        })(val[i], i);
                    }
                }
            },
            stopBindings: true
        }
    }
    $.ViewBindings.disable = {
        update: function( node, val ){
            $.ViewBindings.enable.update(node, !val);
        }
    }
    //if unless with each四种bindings都是基于template bindings
    "if,unless,with,each".replace($.rword, function( type ){
        $.ViewBindings[ type ] = {
            //node, 子访问器的返回值, 子访问器(位于VM), 父访问器(分解元素bind属性得到DOMAccessor)
            init: function(node, val, visit, accessor){
                node.normalize();                  //合并文本节点数
                var fragment = node.ownerDocument.createDocumentFragment(), el
                while((el = node.firstChild)){
                    fragment.appendChild(el);     //将node中的所有节点移出DOM树
                }
                accessor.fragments = [];             //添加一个数组属性,用于储存经过改造的文档碎片
                accessor.fragment = fragment;         //最初的文档碎片,用于克隆
                accessor.cloneFragment = function( dom, unshift ){ //改造文档碎片并放入数组
                    dom = dom || accessor.fragment.cloneNode(true);
                    var add = unshift == true ? "unshift" : "push"
                    accessor.fragments[add]( patchFragment(dom) );//fragments用于each,with等循环生成子节点的绑定中
                    return dom;
                }
                var clone = accessor.cloneFragment();  //先改造一翻,方便在update时调用recover方法
                node.appendChild( clone );          //将文档碎片中的节点放回DOM树
            },
            update: function(node, val, accessor, model, _, args){
                $.ViewBindings['template']['update'](node, val, accessor, model,  (function(){
                    switch(type){//返回结果可能为 -1 0 1 2
                        case "if"://因为if/unless绑定总是对应一个布尔值
                            return  !!val - 0;//1 if
                        case "unless":
                            return  !val - 0; //0  unless
                        case "with":
                            return  2;       //2  with
                        default:
                            $.log("============each===========")
                            return -1;       //-1 each
                    }
                })(), args );
            },
            stopBindings: true
        }
    });
    //data-each-item?-index?
    //each绑定拥有大量的子方法,用于同步数据的增删改查与排序,它们在convertToDomAccessor方法中被调用
    var each = $.ViewBindings.each;
    each.start = function( accessor, models, fragments, method, args ){
        if(!Array.isArray(models)){
            var array = [];//处理对象的for in循环
            array.$isObj = true;
            for(var key in models){
                //通过这里模拟数组行为
                if(models.hasOwnProperty(key)  && (key != "$"+expando)){
                    var value = models[key];
                    array.push( value );
                }
            }
            models = array
        }
        for(var i = 1; i < models.length; i++ ){
            accessor.cloneFragment();//将文档碎片复制到与模型集合的个数一致
        }
        return models
    };
    //push ok
    each.push = function( accessor, models, fragments, method, args ){
        var l = fragments.length
        for(var index = 0; index < args.length; index++ ){
            var n = index + l;
            convertToAccessor(n, models[n], models);
            accessor.cloneFragment()
        }
    }
    //unshift ok
    each.unshift = function( accessor, models, fragments, method, args ){
        for(var index = 0; index < args.length; index++ ){
            convertToAccessor(index, models[index], models);
            accessor.cloneFragment(0, true)
        }
        for( index = 0; index < models.length; index++ ){
            models[index].$key = index;//重排集合元素的$key
        }
    }
    // shift pop ok
    each.shift = function( accessor, models, fragments, method, args ){
        var fragment = fragments[method]();//取得需要移出的文档碎片
        fragment.recover() = null;//让它收集其子节点,然后一同被销毁
        for(var index = 0; index < models.length; index++ ){
            models[index].$key = index;//重排集合元素的$key
        }
    }
    each.pop = each.shift;
    each.splice = function( accessor, models, fragments, method, args ){
        var start = args[0], n = args.length - 2;
        var removes = fragments.splice(start, args[1]);
        //移除对应的文档碎片
        for(var i = 0; i < removes.length; i++){
            removes[i].recover();
        }
        for(i = 0; i < n; i++ ){
            //将新数据封装成域
            var index = start + i
            convertToAccessor(index, models[ index ], models);
            //为这些新数据创建对应的文档碎片
            var dom = accessor.fragment.cloneNode(true);
            accessor.fragments.splice(index, 0, patchFragment(dom) );
        }
        for( index = start+n; index < models.length; index++ ){
            models[index].$key = index
        }
    }
    //对文档碎片进行改造，通过nodes属性取得所有子节点的引用，以方便把它们一并移出DOM树或插入DOM树
    function patchFragment( fragment ){
        fragment.nodes = $.slice( fragment.childNodes );
        fragment.recover = function(){
            this.nodes.forEach(function( el ){
                this.appendChild(el)
            },this);
        }
        return fragment;
    }

    //  var rbindValue = /^[\w$]+(?:\.[\w$]+)*(?:\s*:\s*[\w$]+)?$/
    var rbindValue =   /^[\w$]+(?:(?:\s*:\s*|\.)[\w$]+)*$/
    function getBindings( node ){
        var ret = []
        for ( var j = 0, attr; attr = node.attributes[ j++ ]; ){
            if( attr.name.indexOf(BINDING+"-") == 0 && rbindValue.test(attr.value)){
                ret.push( [attr.name, attr.value.trim()] )
            }
        }
        return ret
    }
    $.ViewModel = function(data, model){
        model = model || {   };
        if(Array.isArray(data)){
            return convertToCollectionAccessor(data);
        }
        for(var p in data) {
            if(data.hasOwnProperty(p) && p !== "commands") {
                convertToAccessor(p, data[p], model);
            }
        }
        return model;
    }
    
    var err = new Error("只能是字符串，数值，布尔，Null，Undefined，函数以及纯净的对象")
    function convertToAccessor( key, val, model ){
        switch( $.type( val ) ){
            case "Null":
            case "Undefined":
            case "String":
            case "NaN":
            case "Number":
            case "Boolean"://属性访问器
                return convertToPropertyAccessor( key, val, model );
            case "Function"://组合访问器
                return convertToCombiningAccessor( key, val, model, "get");
            case "Array"://组合访问器
                var models = model[key] || (model[key] = []);
                return convertToCollectionAccessor( val, models );
            case "Object"://转换为子VM
                if($.isPlainObject( val )){
                    if( $.isFunction( val.setter ) && $.isFunction( val.getter )){
                        return convertToCombiningAccessor( key, val, model, "setget");
                    }else{
                        var object = model[key] || (model[key] = {});
                        $.ViewModel( val, object );
                        return object
                    }
                }else{
                    throw err;
                }
                break;
            default:
                throw err;
        }
    }
    var bridge = {}, //用于收集依赖
    uuid = 0, expando = new Date - 0;
    //属性访问器，它是最简单的可读写访问器，位于双向依赖链的最底层，不依赖于其他访问器就能计算到自己的返回值
    function convertToPropertyAccessor( key, val, host ){
        function accessor( neo ){
            if( bridge[ expando ] ){ //收集依赖于它的访问器或绑定器，,以便它的值改变时,通知它们更新自身
                $.Array.ensure( accessor.$deps, bridge[ expando ] );
            }
            if( arguments.length ){//在传参不等于已有值时,才更新自已,并通知其的依赖
                if( accessor.$val !== neo ){
                    accessor.$val = neo;
                    updateDeps( accessor );
                }
            }
            return accessor.$val;
        }
        accessor.$val = val;
        accessor.$uuid = ++uuid;
        return completeAccessor( key, accessor, host );
    }

    //集合访问器，这是一个特别的数组对象， 用于一组数据进行监控与操作，当它的顺序或个数发生变化时，
    //它会同步到DOM对应的元素集合中去，因此有关这个数组用于添加，删除，排序的方法都被重写了
    //我们可以在页面通过each绑定此对象
    function convertToCollectionAccessor(array, models){
        models = models || [];
        for(var index = 0; index < array.length; index++){
            convertToAccessor(index, array[index], models);
        }
        String("push,pop,shift,unshift,splice,sort,reverse").replace($.rword, function(method){
            var nativeMethod = models[ method ];
            models[ method ] = function(){
                nativeMethod.apply( models, arguments)
                var accessors = models["$"+expando];
                for(var i = 0, accessor; accessor = accessors[i++];){
                    accessor(method, arguments);
                }
            }
        });
        models.removeAt = function(index){//移除指定索引上的元素
            models.splice(index, 1);
        }
        models.remove = function(item){//移除第一个等于给定值的元素
            var array = models.map(function(el){
                return el();
            })
            var index = array.indexOf(item);
            models.removeAt(index);
        }
        return models;
    }
    
    //convertToCombiningAccessor，组合访问器，是指在ViewModel定义时，值为类型为函数，或为一个拥有setter、getter函数的对象。
    //它们是位于双向绑定链的中间层，需要依赖于其他属性访问器或组合访问的返回值计算自己的返回值。
    //当顶层的VM改变了,通知底层的改变
    //当底层的VM改变了,通知顶层的改变
    //当中间层的VM改变,通知两端的改变
    function convertToCombiningAccessor( key, val, host, type){
        var getter, setter//构建一个至少拥有getter,scope属性的对象
        if(type == "get"){//getter必然存在
            getter = val;
        }else if(type == "setget"){
            getter = val.getter;
            setter = val.setter;
            host = val.scope || host;
        }
        function accessor( neo ){
            if( bridge[ expando ] ){
                //收集依赖于它的depsWatch与bindWatch,以便它的值改变时,通知它们更新自身
                $.Array.ensure( accessor.$deps, bridge[ expando ] );
            }
            var change = false;
            if( arguments.length ){//写入新值
                if( setter ){
                    setter.apply( host, arguments );
                }
            }else{
                if( !("$val" in accessor) ){
                    if( !accessor.$uuid ){
                        bridge[ expando ] = accessor;
                        accessor.$uuid = ++uuid;
                    }
                    neo = getter.call( host );
                    change = true;
                    delete bridge[ expando ];
                }
            }
            //放到这里是为了当是最底层的域的值发出改变后,当前域跟着改变,然后再触发更高层的域
            if( change && (accessor.$val !== neo) ){
                accessor.$val = neo;
                //通知此域的所有直接依赖者更新自身
                updateDeps( accessor );
            }
            return accessor.$val;
        }
        return completeAccessor( key, accessor, host );
    }
    //通知此监控函数或数组的所有直接依赖者更新自身
    function updateDeps(accessor){
        var list = accessor.$deps || [] ;
        if( list.length ){
            var safelist = list.concat();
            for(var i = 0, el; el = safelist[i++];){
                delete el.$val;
                el() //强制重新计算自身
            }
        }
    }
    //为访问器添加更多必须的方法或属性，让其真正可用！必要将它绑到VM中！
    function completeAccessor( key, accessor, host ){
        //收集依赖于它的访问器或绑定器，,以便它的值改变时,通知它们更新自身
        accessor.toString = accessor.valueOf = function(){
            if( bridge[ expando ] ){
                $.Array.ensure( accessor.$deps, bridge[ expando ] );
            }
            return accessor.$val
        }
        if(!host.nodeType){
            accessor.$key = key;
            host[ key ] = accessor;
        }
        accessor.$deps = [];
        accessor();
        return accessor;
    }
    
    
    
    return $;
})
