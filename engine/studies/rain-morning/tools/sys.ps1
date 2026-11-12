# Prints a one-line snapshot of CPU / RAM / GPU load so heavy steps can be throttled.
$cpu = (Get-CimInstance Win32_Processor).LoadPercentage
$os = Get-CimInstance Win32_OperatingSystem
$freeGb = [math]::Round($os.FreePhysicalMemory / 1MB, 1)
$totGb = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
$gpu = 0; $shared = 0; $ded = 0
try {
  $c = Get-Counter '\GPU Engine(*engtype_3D)\Utilization Percentage' -ErrorAction Stop
  $gpu = [math]::Round(($c.CounterSamples | Measure-Object CookedValue -Sum).Sum, 0)
  $m = Get-Counter '\GPU Adapter Memory(*)\Shared Usage', '\GPU Adapter Memory(*)\Dedicated Usage' -ErrorAction Stop
  $shared = [math]::Round((($m.CounterSamples | Where-Object Path -like '*shared usage' | Measure-Object CookedValue -Sum).Sum) / 1GB, 2)
  $ded = [math]::Round((($m.CounterSamples | Where-Object Path -like '*dedicated usage' | Measure-Object CookedValue -Sum).Sum) / 1GB, 2)
} catch {}
"CPU ${cpu}%  RAM free ${freeGb}/${totGb} GB  GPU3D ${gpu}%  GPUmem dedicated ${ded} GB shared ${shared} GB"
