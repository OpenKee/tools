export default {
  en: {
    lead: 'Browser checks for the listed API endpoints: availability, latency and response sanity.',
    probeNow: 'Probe now',
    probing: 'Probing…',
    auto: 'Auto refresh (60s)',
    ok: 'OK',
    fail: 'FAIL',
    timeout: 'TIMEOUT',
    pending: 'PENDING',
    lastRun: 'Last run',
    none: 'No results yet — press "Probe now".',
    reachable: 'Reachable only; response unreadable',
    footer:
      'Results reflect this browser and network, not a service-wide guarantee. Opaque responses confirm only network reachability, not HTTP status or content. Open the endpoint links above for the exact URLs tested.',
  },
  zh: {
    lead: '在浏览器中检查下列 API 端点的可用性、延迟与响应格式，清单包含历史探针。',
    probeNow: '重新探测',
    probing: '探测中…',
    auto: '自动刷新（60 秒）',
    ok: '正常',
    fail: '失败',
    timeout: '超时',
    pending: '待测',
    lastRun: '上次探测',
    none: '还没有结果——点"重新探测"。',
    reachable: '仅网络可达，无法读取响应',
    footer:
      '结果仅反映当前浏览器和网络，并非服务整体可用性的保证。不透明响应仅表示网络可达，无法确认 HTTP 状态或内容；上方端点链接即实际探测地址。',
  },
}
