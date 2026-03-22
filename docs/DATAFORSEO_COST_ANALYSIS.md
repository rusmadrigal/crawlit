# Análisis de gasto DataForSEO (19.02 - 21.03.2026: $32.62)

Este documento cruza el **Prices.xlsx** con los endpoints que usa CrawliT para identificar dónde se gasta más.

## Resumen ejecutivo

| Endpoint | Precio por request | Uso estimado | Impacto |
|----------|--------------------|--------------|---------|
| **historical_rank_overview** | $0.10 + $0.001/resultado | 1 por overview full | **ALTO** |
| **keywords_for_site** | $0.05–0.075 | 1 por overview full | **ALTO** |
| **search_volume** (google_ads) | $0.075 | 1 por overview (20 kw) | **ALTO** |
| **keyword_ideas** | $0.01 + $0.0001/resultado | Keyword research | Medio |
| **ranked_keywords** | $0.01 + $0.0001/resultado | 1 si no hay GSC | Bajo |
| **bulk_keyword_difficulty** | $0.01 + $0.0001/resultado | 1 (20 kw) | Bajo |
| **search_intent** | $0.001 + $0.0001/resultado | 1 (20 kw) | Bajo |

---

## Endpoints que usa CrawliT (mapeados a Prices.xlsx)

### 1. Domain Overview (Performance) — **≈ $0.35–0.45 por carga completa**

Cada vez que cargas un proyecto sin caché se ejecutan varios endpoints:

| API | Endpoint | Precio (Prices) | Coste estimado/carga |
|-----|----------|-----------------|----------------------|
| keywords_data | keywords_for_site (google o google_ads) | $0.05–0.075 | **~$0.07** |
| dataforseo_labs | historical_rank_overview/live | $0.10 + $0.001/result | **~$0.12** (24 meses) |
| dataforseo_labs | ranked_keywords/live | $0.01 + $0.0001/result | ~$0.015 (50 kw) |
| keywords_data | google_ads/search_volume/live | $0.075 | **~$0.075** |
| dataforseo_labs | search_intent/live | $0.001 + $0.0001/result | ~$0.003 (20 kw) |
| dataforseo_labs | bulk_keyword_difficulty/live | $0.01 + $0.0001/result | ~$0.012 (20 kw) |

**Total por overview completo (sin caché): ~$0.30–0.40**

Si el proyecto tiene GSC: se omite `ranked_keywords` pero se usan search_volume, search_intent y bulk_keyword_difficulty para las top 20 queries de GSC.

### 2. Keyword Research (formulario) — **≈ $0.015–0.02 por búsqueda**

| API | Endpoint | Precio | Coste |
|-----|----------|--------|-------|
| dataforseo_labs | keyword_ideas/live | $0.01 + $0.0001/result | ~$0.015 (50 ideas) |

---

## Estimación del gasto de $32.62

Con ~$0.35 por overview completo:

- **~93 cargas completas de overview** explicarían todo el gasto, o
- Menos cargas si también usas mucho el **Keyword Research** u otras APIs.

Con más de un proyecto o cambios frecuentes de vista (mensual/diario, 12m/2y), es fácil llegar a varias decenas de cargas en un mes.

---

## Dónde se gasta más

1. **historical_rank_overview** (~$0.12/carga): el más caro del overview.
2. **search_volume** (google_ads) ($0.075): se llama siempre que hay GSC o ranked keywords.
3. **keywords_for_site** (~$0.07): una llamada por overview completo.
4. **keyword_ideas**: bajo por búsqueda, pero puede sumar si se usa mucho.

---

## Recomendaciones para reducir coste

1. **Cache persistente (ya implementada)**: evita repetir DataForSEO cuando hay datos recientes.
2. **skipDataforseo en cache+GSC (ya implementado)**: no vuelve a pedir volume/KD/intent cuando ya están en caché.
3. **Actualización solo bajo demanda (ya implementado)**: cambiar vista (mensual↔diario, 12m↔2y) no dispara fetch automático; solo al abrir proyecto o al hacer Refresh.
4. **Apagar DataForSEO en Settings**: cuando no necesites datos nuevos, usar solo caché + GA4/GSC.
5. **Evitar refrescar sin necesidad**: cada Refresh hace una carga completa.
6. **Caché más larga**: 4h está bien; 8–12h reduciría más el gasto si la frescura no es crítica.
7. **Keyword Research**: limitar búsquedas frecuentes o reducir el `limit` (ej. 30 en vez de 50).

---

## Nota sobre el reporte de DataForSEO

El **Prices.xlsx** solo contiene la tarifa por endpoint. Para saber el gasto real por endpoint necesitas el **usage report** de DataForSEO (app.dataforseo.com → Billing / Usage), donde verás:

- Número de requests por endpoint
- Coste por endpoint

Con eso puedes comprobar si el gasto coincide con estas estimaciones.
