import io, re, sys

p = 'app/globals.css'
c = io.open(p, encoding='utf-8').read()
base = 14.0

def fmt(v):
    s = ('%.4f' % v).rstrip('0').rstrip('.')
    return s

count = [0]
def repl(m):
    val = float(m.group(1))
    count[0] += 1
    return 'font-size:%srem' % fmt(val / base)

# 只替换 font-size 声明里的 px，不碰其它属性
new = re.sub(r'font-size:([0-9.]+)px', repl, c)

# 已被 --font-scale 包着的 calc 表达式先还原成 px 再统一换算
new = re.sub(r'font-size:calc\(([0-9.]+)px \* var\(--font-scale,1\)\)',
             lambda m: 'font-size:%srem' % fmt(float(m.group(1)) / base), new)

io.open(p, 'w', encoding='utf-8', newline='').write(new)
print('converted', count[0])
