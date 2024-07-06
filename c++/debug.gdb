target remote | vgdb
watch *(bool **) 0x50b7e80
commands 1
bt
c
end
watch *(bool *) 0x1ffeffe9dc
commands 2
bt
c
end
c
