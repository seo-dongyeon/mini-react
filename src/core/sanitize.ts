/**
 * 사용자가 입력한 HTML에서 스크립트가 실행될 수 있는 부분을 제자리에서 지우고, 지운 내용을 돌려준다.
 * <template>로 파싱한(아직 실행되지 않은) DOM에 대해 VNode로 바꾸기 전에 호출한다.
 *
 * shortcut: 차단 목록 방식이라 목록에 없는 공격 경로는 막지 못한다. 외부에 공개 배포하면 허용 목록 방식으로 바꾼다.
 */
const BLOCKED_TAGS = new Set([
  'script', 'iframe', 'frame', 'object', 'embed', // 코드 실행·외부 문서 삽입
  'style', 'link', 'meta', 'base', // 페이지 전체 스타일·주소·이동을 바꿈
])
const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'xlink:href'])
const attrNameChecker = document.createElement('div')

export function sanitize(root: Node & ParentNode): string[] {
  const warnings: string[] = []
  // 지우는 도중 목록이 바뀌지 않도록 먼저 배열로 복사한다.
  for (const el of Array.from(root.querySelectorAll('*'))) {
    if (!root.contains(el)) continue // 이미 지운 요소 안에 있던 요소
    const tag = el.tagName.toLowerCase()
    if (BLOCKED_TAGS.has(tag)) {
      el.remove()
      warnings.push(`<${tag}> 태그를 제거했어`)
      continue
    }
    for (const attr of Array.from(el.attributes)) {
      const reason = blockedAttrReason(attr.name, attr.value)
      if (!reason) continue
      el.removeAttribute(attr.name)
      warnings.push(`<${tag}>의 ${attr.name} 속성을 제거했어 (${reason})`)
    }
  }
  return warnings
}

function blockedAttrReason(name: string, value: string): string | null {
  const lower = name.toLowerCase()
  if (lower.startsWith('on')) return '이벤트 핸들러'
  // 브라우저는 URL 앞의 공백·제어 문자를 무시하므로 같은 방식으로 지우고 비교한다.
  const url = value.replace(/[\u0000- ]/g, '').toLowerCase()
  if (URL_ATTRS.has(lower) && (url.startsWith('javascript:') || url.startsWith('vbscript:'))) {
    return '스크립트 URL'
  }
  // 파서는 `"a` 같은 이름도 받아 주지만 setAttribute는 거부한다. 렌더링이 깨지지 않게 미리 지운다.
  try {
    attrNameChecker.setAttribute(name, '')
    attrNameChecker.removeAttribute(name)
  } catch {
    return '잘못된 속성 이름'
  }
  return null
}
