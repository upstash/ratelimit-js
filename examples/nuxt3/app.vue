<script setup lang="ts">
const { data, pending, refresh } = await useFetch("/api/ratelimit", {
  transform: (v) => ({
    ...v,
    reset: new Date(v.reset).toUTCString(),
  }),
});
</script>

<template>
  <UContainer as="main" class="min-h-screen py-6 flex flex-col items-center justify-center gap-10">
    <div class="flex items-center text-4xl lg:text-7xl h-52 lg:h-96 font-semibold text-center">
      <div v-if="data.success">
        <p class="text-primary-500">Nuxt</p>
        +
        <p>@upstash/ratelimit</p>
        +
        <p>Vercel KV</p>
      </div>

      <div v-else>
        You have reached the limit,
        <br />
        please come back later
      </div>
    </div>

    <div>
      <UButton size="lg" :loading="pending" class="transition" @click="refresh()">Refresh</UButton>
    </div>

    <div class="grid lg:grid-cols-4 gap-4">
      <UCard v-for="(value, key) in data" :key="key" class="text-center">
        <template #header>
          <p class="text-xl capitalize">{{ key }}</p>
        </template>
        {{ value }}
      </UCard>
    </div>
  </UContainer>
</template>
